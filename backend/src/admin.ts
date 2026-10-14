import { Router } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { publicLicense } from './licensing.js';

export const adminListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
  licenseState: z.enum(['all', 'active', 'trial', 'monthly', 'pending', 'expired', 'revoked', 'none']).default('all')
});

export function adminUserFilter(input: z.infer<typeof adminListSchema>, now = new Date()): Prisma.UserWhereInput {
  const filters: Prisma.UserWhereInput[] = [];
  if (input.search) filters.push({ OR: ['id', 'name', 'email'].map((field) => ({ [field]: { contains: input.search, mode: 'insensitive' } })) });
  const valid: Prisma.LicenseWhereInput = { revokedAt: null, expiresAt: { gt: now }, activatedAt: { not: null } };
  switch (input.licenseState) {
    case 'active': filters.push({ licenses: { some: valid } }); break;
    case 'trial': filters.push({ licenses: { some: { ...valid, kind: 'TRIAL' } } }); break;
    case 'monthly': filters.push({ licenses: { some: { ...valid, kind: 'MONTHLY' } } }); break;
    case 'pending': filters.push({ licenses: { some: { revokedAt: null, expiresAt: { gt: now }, activatedAt: null } } }); break;
    case 'expired': filters.push({ licenses: { some: { revokedAt: null, expiresAt: { lte: now } } } }); break;
    case 'revoked': filters.push({ AND: [{ licenses: { none: { revokedAt: null } } }, { licenses: { some: { revokedAt: { not: null } } } }] }); break;
    case 'none': filters.push({ licenses: { none: {} } }); break;
  }
  return filters.length ? { AND: filters } : {};
}

export function createAdminRouter(db: PrismaClient) {
  const router = Router();
  router.get('/overview', async (_req, res) => {
    const now = new Date();
    const active = { revokedAt: null, activatedAt: { not: null }, expiresAt: { gt: now } };
    const [clients, issuedKeys, activeLicenses, activeTrials, activeMonthly, pendingActivation, expiredLicenses, revokedKeys, payments, revenue] = await db.$transaction([
      db.user.count(), db.license.count(), db.license.count({ where: active }),
      db.license.count({ where: { ...active, kind: 'TRIAL' } }), db.license.count({ where: { ...active, kind: 'MONTHLY' } }),
      db.license.count({ where: { revokedAt: null, activatedAt: null, expiresAt: { gt: now } } }),
      db.license.count({ where: { revokedAt: null, expiresAt: { lte: now } } }),
      db.license.count({ where: { revokedAt: { not: null } } }),
      db.manualPayment.count(), db.manualPayment.aggregate({ _sum: { amountCents: true } })
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json({ clients, issuedKeys, activeLicenses, activeTrials, activeMonthly, pendingActivation, expiredLicenses, revokedKeys, payments, confirmedAmountCents: revenue._sum.amountCents ?? 0 });
  });
  router.get('/users', async (req, res) => {
    const input = adminListSchema.parse(req.query);
    const where = adminUserFilter(input);
    const [total, users] = await db.$transaction([
      db.user.count({ where }),
      db.user.findMany({ where, take: input.pageSize, skip: (input.page - 1) * input.pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
        id: true, name: true, email: true, phone: true, trialStartedAt: true, createdAt: true,
        licenses: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true, keyPrefix: true, kind: true, expiresAt: true, activatedAt: true, revokedAt: true, createdAt: true } }
      } })
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json({ items: users.map((user) => ({ ...user, licenses: user.licenses.map(publicLicense) })), total, page: input.page, pageSize: input.pageSize, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) });
  });
  router.get('/payments', async (req, res) => {
    const input = adminListSchema.pick({ page: true, pageSize: true }).extend({ userId: z.string().max(64).optional() }).parse(req.query);
    const where = input.userId ? { userId: input.userId } : {};
    const [total, items] = await db.$transaction([
      db.manualPayment.count({ where }), db.manualPayment.findMany({ where, take: input.pageSize, skip: (input.page - 1) * input.pageSize, orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }], select: {
        id: true, reference: true, amountCents: true, confirmedAt: true,
        user: { select: { id: true, name: true, email: true } },
        license: { select: { id: true, keyPrefix: true, kind: true, expiresAt: true, revokedAt: true } }
      } })
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json({ items, total, page: input.page, pageSize: input.pageSize, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) });
  });
  return router;
}
