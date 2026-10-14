import { LicenseKind, Prisma, type PrismaClient } from '@prisma/client';
import { createSecret, hashSecret } from './security.js';
import { HttpError, LicenseAccessError } from './errors.js';

export const trialEnd = (start: Date) => new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

// Mês de calendário em UTC, mantendo a hora e limitando ao último dia do mês.
export function addCalendarMonth(start: Date) {
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

export const hasAccess = (license: { revokedAt: Date | null; expiresAt: Date; activatedAt: Date | null } | null, now: Date) =>
  Boolean(license && license.activatedAt && !license.revokedAt && license.expiresAt.getTime() > now.getTime());

export async function requireLicense(db: PrismaClient, userId: string, now = new Date()) {
  const license = await db.license.findFirst({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!hasAccess(license, now)) throw new LicenseAccessError();
  return license!;
}

async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'Usuário não encontrado');
  return user;
}

function newKey() {
  const key = createSecret('wpp');
  return { key, keyHash: hashSecret(key), keyPrefix: key.slice(0, 12) };
}

export async function startTrial(db: PrismaClient, userId: string) {
  return db.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (user.trialStartedAt || await tx.license.count({ where: { userId } })) {
      throw new HttpError(409, 'Esta conta já ativou um teste ou uma licença. O benefício não pode ser reiniciado.');
    }
    const now = new Date();
    const expiresAt = trialEnd(now);
    const secret = newKey();
    await tx.user.update({ where: { id: userId }, data: { trialStartedAt: now, trialEndsAt: expiresAt } });
    const license = await tx.license.create({ data: { userId, keyHash: secret.keyHash, keyPrefix: secret.keyPrefix, kind: LicenseKind.TRIAL, expiresAt, activatedAt: now } });
    return { key: secret.key, license: publicLicense(license) };
  });
}

export async function issueMonthlyLicense(db: PrismaClient, userId: string, payment: { reference: string; amountCents: number }) {
  const reference = payment.reference.trim().toUpperCase();
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    if (await tx.manualPayment.findUnique({ where: { reference } })) {
      throw new HttpError(409, 'Este pagamento já foi utilizado. Não foi emitida outra licença.');
    }
    const now = new Date();
    const previous = await tx.license.findFirst({ where: { userId, revokedAt: null, kind: LicenseKind.MONTHLY }, orderBy: { expiresAt: 'desc' } });
    const expiresAt = addCalendarMonth(previous && previous.expiresAt > now ? previous.expiresAt : now);
    const secret = newKey();
    await tx.license.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    const license = await tx.license.create({ data: { userId, keyHash: secret.keyHash, keyPrefix: secret.keyPrefix, kind: LicenseKind.MONTHLY, expiresAt } });
    await tx.manualPayment.create({ data: { userId, licenseId: license.id, reference, amountCents: payment.amountCents } });
    return { key: secret.key, license: publicLicense(license) };
  });
}

export async function activateLicense(db: PrismaClient, userId: string, key: string) {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const license = await tx.license.findUnique({ where: { keyHash: hashSecret(key) } });
    const now = new Date();
    if (!license || license.userId !== userId || license.revokedAt || license.expiresAt <= now) {
      throw new HttpError(403, 'Chave inválida, vencida ou pertencente a outra conta.');
    }
    return publicLicense(await tx.license.update({ where: { id: license.id }, data: { activatedAt: license.activatedAt ?? now } }));
  });
}

export async function revokeLicense(db: PrismaClient, userId: string) {
  await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.license.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  });
}

export async function rotateLicense(db: PrismaClient, userId: string) {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const current = await tx.license.findFirst({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    const now = new Date();
    if (!current || current.expiresAt <= now) throw new HttpError(409, 'Não há licença vigente para reemitir. Confirme um novo pagamento para renovar.');
    const secret = newKey();
    await tx.license.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    const license = await tx.license.create({ data: { userId, keyHash: secret.keyHash, keyPrefix: secret.keyPrefix, kind: current.kind, expiresAt: current.expiresAt } });
    return { key: secret.key, license: publicLicense(license) };
  });
}

export function publicLicense(license: { id: string; keyPrefix: string; kind: LicenseKind; expiresAt: Date; activatedAt: Date | null; revokedAt: Date | null; createdAt: Date }) {
  return { id: license.id, keyPrefix: license.keyPrefix, kind: license.kind, expiresAt: license.expiresAt, activatedAt: license.activatedAt, revokedAt: license.revokedAt, createdAt: license.createdAt, active: hasAccess(license, new Date()) };
}
