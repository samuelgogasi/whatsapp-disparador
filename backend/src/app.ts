import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { CampaignStatus, Prisma, type PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { campaignSchema, userIdSchema } from './validation.js';
import { authenticate, authenticateAdmin, authRateLimit, createLoginSession, readSessionToken, sessionCookie } from './auth.js';
import { activateLicense, issueMonthlyLicense, publicLicense, requireLicense, revokeLicense, rotateLicense, startTrial } from './licensing.js';
import { hashPassword, hashSecret, verifyPassword } from './security.js';
import { HttpError } from './errors.js';
import { buildCampaignJobs, type EnqueuedDispatch } from './scheduling.js';
import { pairingSchema } from './pairing.js';
import { createAdminRouter } from './admin.js';

export type AppDependencies = {
  db: PrismaClient;
  whatsapp: {
    connect: (userId: string) => Promise<unknown>;
    requestPairingCode: (userId: string, phoneNumber: string) => Promise<unknown>;
    getQr: (userId: string) => string | null;
    getStatus: (userId: string) => { connected: boolean; status: string };
    listGroups: (userId: string) => Promise<{ id: string; subject: string }[]>;
  };
  enqueue: (jobs: EnqueuedDispatch[]) => Promise<unknown>;
  checkReady?: () => Promise<void>;
};

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(10).max(128);
const registrationSchema = z.object({ name: z.string().trim().min(2).max(80), email, password });
const loginSchema = z.object({ email, password });
const paymentSchema = z.object({ reference: z.string().trim().min(6).max(128), amountCents: z.number().int().positive().max(100_000_000), confirmed: z.literal(true) });

export function createApp(deps: AppDependencies, settings = config) {
  const { db, whatsapp, enqueue } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" });
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const expectedOrigin = settings.publicUrl ? new URL(settings.publicUrl).origin : `${req.protocol}://${req.get('host')}`;
      if (req.get('origin') && req.get('origin') !== expectedOrigin) return next(new HttpError(403, 'Origem da requisição não autorizada.'));
      if (!req.is('application/json')) return next(new HttpError(415, 'Envie JSON para esta operação.'));
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'whatsapp-news-backend' }));
  app.get('/ready', async (_req, res) => {
    try {
      if (!deps.checkReady) return res.status(503).json({ ok: false });
      await deps.checkReady();
      return res.json({ ok: true });
    } catch { return res.status(503).json({ ok: false }); }
  });
  app.get('/api/public', (_req, res) => res.json({ trialDays: 7 }));

  const secureCookie = settings.publicUrl?.startsWith('https://') ?? false;
  app.use('/api/auth', authRateLimit());
  app.post('/api/auth/register', async (req, res) => {
    const input = registrationSchema.parse(req.body);
    const user = await db.user.create({ data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) } });
    await createLoginSession(db, user.id, res, secureCookie);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  });
  app.post('/api/auth/login', async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    // Mesmo trabalho criptográfico para uma conta inexistente.
    const stored = user?.passwordHash ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    if (!(await verifyPassword(input.password, stored)) || !user?.passwordHash) throw new HttpError(401, 'E-mail ou senha inválidos.');
    await createLoginSession(db, user.id, res, secureCookie);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token = readSessionToken(req);
    if (token) await db.authSession.deleteMany({ where: { tokenHash: hashSecret(token) } });
    res.clearCookie(sessionCookie, { httpOnly: true, secure: secureCookie, sameSite: 'strict', path: '/' });
    res.json({ ok: true });
  });

  app.use('/api/admin', authRateLimit(100), authenticateAdmin(settings.adminApiToken));
  app.use('/api/admin', createAdminRouter(db));
  app.post('/api/admin/users/:userId/monthly-license', async (req, res) => {
    const userId = userIdSchema.parse(req.params.userId);
    const payment = paymentSchema.parse(req.body);
    res.status(201).json(await issueMonthlyLicense(db, userId, payment));
  });
  app.post('/api/admin/users/:userId/revoke-license', async (req, res) => {
    await revokeLicense(db, userIdSchema.parse(req.params.userId));
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:userId/rotate-license', async (req, res) => {
    res.status(201).json(await rotateLicense(db, userIdSchema.parse(req.params.userId)));
  });

  app.use('/api', authenticate(db));
  app.get('/api/payment-info', (_req, res) => res.json({ pixKey: settings.pixKey ?? null, paymentWhatsapp: settings.paymentWhatsapp ?? null }));
  app.get('/api/me', async (_req, res) => {
    const user = await db.user.findUniqueOrThrow({ where: { id: res.locals.userId }, select: { id: true, name: true, email: true, trialStartedAt: true, trialEndsAt: true } });
    const license = await db.license.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    res.json({ user, license: license ? publicLicense(license) : null });
  });
  app.post('/api/license/trial', async (_req, res) => res.status(201).json(await startTrial(db, res.locals.userId)));
  app.post('/api/license/activate', authRateLimit(), async (req, res) => {
    const { key } = z.object({ key: z.string().regex(/^wpp_[A-Za-z0-9_-]{43}$/) }).parse(req.body);
    res.json({ license: await activateLicense(db, res.locals.userId, key) });
  });

  app.use('/api/sessions/:userId', (req, res, next) => {
    if (req.params.userId !== res.locals.userId) return next(new HttpError(403, 'Você só pode acessar sua própria sessão.'));
    next();
  });
  app.get('/api/sessions/:userId/status', (_req, res) => res.json(whatsapp.getStatus(res.locals.userId)));
  app.post('/api/sessions/:userId/connect', async (_req, res) => {
    await requireLicense(db, res.locals.userId);
    res.json(await whatsapp.connect(res.locals.userId));
  });
  app.post('/api/sessions/:userId/pairing-code', authRateLimit(10), async (req, res) => {
    const { phoneNumber } = pairingSchema.parse(req.body);
    await requireLicense(db, res.locals.userId);
    const result = await whatsapp.requestPairingCode(res.locals.userId, phoneNumber);
    await requireLicense(db, res.locals.userId);
    res.json(result);
  });
  app.get('/api/sessions/:userId/qr', async (_req, res) => {
    await requireLicense(db, res.locals.userId);
    const qr = whatsapp.getQr(res.locals.userId);
    if (!qr) throw new HttpError(404, 'QR Code ainda não disponível.');
    res.json({ qr });
  });
  app.get('/api/sessions/:userId/groups', async (_req, res) => {
    await requireLicense(db, res.locals.userId);
    res.json({ groups: await whatsapp.listGroups(res.locals.userId) });
  });
  app.post('/api/campaigns', async (req, res) => {
    if (req.body?.userId && req.body.userId !== res.locals.userId) throw new HttpError(403, 'Campanha deve pertencer à sua conta.');
    const input = campaignSchema.parse({ ...req.body, userId: res.locals.userId });
    await requireLicense(db, input.userId);
    if (input.mediaUrl) throw new HttpError(400, 'Envio de mídia indisponível nesta versão de homologação. Use texto e link da matéria.');
    const groups = await whatsapp.listGroups(input.userId);
    const available = new Set(groups.map((group) => group.id));
    if (input.groupJids.some((id) => !available.has(id))) throw new HttpError(400, 'Selecione apenas grupos disponíveis na sua sessão.');
    const campaign = await db.campaign.create({ data: { userId: input.userId, text: input.text, mediaUrl: input.mediaUrl, mediaType: input.mediaType, scheduledAt: input.scheduledAt, totalGroups: input.groupJids.length, status: input.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.PENDING, messageLogs: { create: input.groupJids.map((groupJid) => ({ userId: input.userId, groupJid })) } } });
    await enqueue(buildCampaignJobs({ id: campaign.id, ...input }));
    res.status(202).json({ campaignId: campaign.id, queued: input.groupJids.length, scheduledAt: campaign.scheduledAt });
  });
  app.get('/api/campaigns', async (_req, res) => res.json(await db.campaign.findMany({ where: { userId: res.locals.userId }, take: 50, include: { _count: { select: { messageLogs: true } } }, orderBy: { createdAt: 'desc' } })));
  app.get('/api/campaigns/:id/logs', async (req, res) => {
    const campaign = await db.campaign.findFirst({ where: { id: req.params.id, userId: res.locals.userId } });
    if (!campaign) throw new HttpError(404, 'Campanha não encontrada.');
    res.json(await db.messageLog.findMany({ where: { campaignId: campaign.id, userId: res.locals.userId }, orderBy: { createdAt: 'asc' } }));
  });

  app.use(express.static(path.join(fileURLToPath(new URL('../public/', import.meta.url)))));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map((issue) => issue.message).join(', ') });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'E-mail ou referência de pagamento já cadastrados.' });
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'JSON inválido.' });
    console.error('Falha na API:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'Erro interno. Tente novamente ou entre em contato com o suporte.' });
  });
  return app;
}
