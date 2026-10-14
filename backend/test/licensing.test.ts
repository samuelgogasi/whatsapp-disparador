import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { activateLicense, addCalendarMonth, hasAccess, issueMonthlyLicense, requireLicense, revokeLicense, rotateLicense, startTrial, trialEnd } from '../src/licensing.js';
import { hashPassword, hashSecret, verifyPassword } from '../src/security.js';

function fixture() {
  let state: { users: any[]; licenses: any[]; payments: any[] } = {
    users: [{ id: 'alice', trialStartedAt: null }, { id: 'bob', trialStartedAt: null }], licenses: [], payments: []
  };
  let sequence = 0;
  const tx = {
    $queryRaw: async () => [],
    user: {
      findUnique: async ({ where }: any) => state.users.find((user) => user.id === where.id) ?? null,
      update: async ({ where, data }: any) => Object.assign(state.users.find((user) => user.id === where.id), data)
    },
    license: {
      count: async ({ where }: any) => state.licenses.filter((license) => license.userId === where.userId).length,
      create: async ({ data }: any) => { const row = { id: `license-${++sequence}`, createdAt: new Date(), revokedAt: null, activatedAt: null, ...data }; state.licenses.push(row); return row; },
      findFirst: async ({ where, orderBy }: any) => state.licenses.filter((license) => license.userId === where.userId && (where.revokedAt === undefined || license.revokedAt === where.revokedAt) && (!where.kind || license.kind === where.kind)).sort((a, b) => orderBy.expiresAt ? b.expiresAt - a.expiresAt : b.id.localeCompare(a.id))[0] ?? null,
      findUnique: async ({ where }: any) => state.licenses.find((license) => license.keyHash === where.keyHash) ?? null,
      updateMany: async ({ where, data }: any) => { state.licenses.filter((license) => license.userId === where.userId && license.revokedAt === null).forEach((license) => Object.assign(license, data)); return {}; },
      update: async ({ where, data }: any) => Object.assign(state.licenses.find((license) => license.id === where.id), data)
    },
    manualPayment: {
      findUnique: async ({ where }: any) => state.payments.find((payment) => payment.reference === where.reference) ?? null,
      create: async ({ data }: any) => { state.payments.push(data); return data; }
    }
  };
  const db = { ...tx, $transaction: async (callback: any) => {
    const snapshot = structuredClone(state);
    try { return await callback(tx); } catch (error) { state = snapshot; throw error; }
  } } as unknown as PrismaClient;
  return { db, state: () => state };
}

test('mês de calendário limita dia 31, trata ano bissexto e preserva horário UTC', () => {
  assert.equal(addCalendarMonth(new Date('2026-01-31T15:20:00Z')).toISOString(), '2026-02-28T15:20:00.000Z');
  assert.equal(addCalendarMonth(new Date('2028-01-31T15:20:00Z')).toISOString(), '2028-02-29T15:20:00.000Z');
  assert.equal(addCalendarMonth(new Date('2026-12-08T15:20:00Z')).toISOString(), '2027-01-08T15:20:00.000Z');
});
test('teste dura 168 horas e licença bloqueia exatamente no vencimento', () => {
  const start = new Date('2026-10-08T15:00:00Z'); const expiresAt = trialEnd(start);
  assert.equal(expiresAt.getTime() - start.getTime(), 168 * 3600000);
  assert.equal(hasAccess({ activatedAt: start, revokedAt: null, expiresAt }, new Date(expiresAt.getTime() - 1)), true);
  assert.equal(hasAccess({ activatedAt: start, revokedAt: null, expiresAt }, expiresAt), false);
  assert.equal(hasAccess({ activatedAt: null, revokedAt: null, expiresAt }, start), false);
});
test('teste só pode começar uma vez e mantém registro após revogação', async () => {
  const { db, state } = fixture(); const trial = await startTrial(db, 'alice');
  assert.equal(trial.license.active, true);
  assert.equal(state().licenses[0].keyHash, hashSecret(trial.key));
  assert.equal(JSON.stringify(state()).includes(trial.key), false);
  await revokeLicense(db, 'alice');
  await assert.rejects(startTrial(db, 'alice'), /já ativou/);
  await assert.rejects(requireLicense(db, 'alice'), /Licença/);
});
test('Pix emite chave vinculada ao usuário; só a ativação do titular libera envios', async () => {
  const { db } = fixture(); const result = await issueMonthlyLicense(db, 'alice', { reference: 'PIX-000001', amountCents: 9900 });
  assert.equal(result.license.active, false);
  await assert.rejects(requireLicense(db, 'alice'), /Licença/);
  await assert.rejects(activateLicense(db, 'bob', result.key), /outra conta/);
  assert.equal((await activateLicense(db, 'alice', result.key)).active, true);
  const first = await requireLicense(db, 'alice');
  await activateLicense(db, 'alice', result.key);
  assert.equal((await requireLicense(db, 'alice')).expiresAt.toISOString(), first.expiresAt.toISOString());
});
test('renovação antecipada preserva período pago, troca chave e invalida chave antiga', async () => {
  const { db } = fixture(); const first = await issueMonthlyLicense(db, 'alice', { reference: 'PIX-000001', amountCents: 9900 });
  await activateLicense(db, 'alice', first.key);
  const second = await issueMonthlyLicense(db, 'alice', { reference: 'PIX-000002', amountCents: 9900 });
  assert.notEqual(first.key, second.key);
  assert.equal(second.license.expiresAt.toISOString(), addCalendarMonth(first.license.expiresAt).toISOString());
  await assert.rejects(activateLicense(db, 'alice', first.key), /inválida/);
  assert.equal((await activateLicense(db, 'alice', second.key)).active, true);
});
test('mesmo Pix, inclusive com outra capitalização, não renova e não revoga acesso existente', async () => {
  const { db, state } = fixture(); const first = await issueMonthlyLicense(db, 'alice', { reference: 'PIX-000001', amountCents: 9900 });
  await activateLicense(db, 'alice', first.key);
  await assert.rejects(issueMonthlyLicense(db, 'alice', { reference: ' pix-000001 ', amountCents: 9900 }), /já foi utilizado/);
  await assert.rejects(issueMonthlyLicense(db, 'bob', { reference: 'PIX-000001', amountCents: 9900 }), /já foi utilizado/);
  assert.equal(state().licenses.length, 1);
  assert.equal(state().payments.length, 1);
  assert.equal((await requireLicense(db, 'alice')).id, first.license.id);
});
test('renovação de licença vencida ou revogada começa do presente', async () => {
  const { db, state } = fixture(); await issueMonthlyLicense(db, 'alice', { reference: 'PIX-000001', amountCents: 9900 });
  state().licenses[0].expiresAt = new Date('2020-01-01T00:00:00Z');
  const before = addCalendarMonth(new Date());
  const result = await issueMonthlyLicense(db, 'alice', { reference: 'PIX-000002', amountCents: 9900 });
  assert.ok(result.license.expiresAt >= before);
  await revokeLicense(db, 'alice');
  await assert.rejects(requireLicense(db, 'alice'), /Licença/);
});
test('senha tem salt individual, aceita senha correta e rejeita incorreta', async () => {
  const first = await hashPassword('senha-segura-teste'); const second = await hashPassword('senha-segura-teste');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('senha-segura-teste', first), true);
  assert.equal(await verifyPassword('senha-incorreta', first), false);
  assert.equal(await verifyPassword('senha-segura-teste', 'invalid'), false);
});

test('reemitir chave perdida preserva validade e não registra nem consome novo pagamento', async () => {
  const { db, state } = fixture(); const first = await issueMonthlyLicense(db, 'alice', { reference: 'PIX-000001', amountCents: 9900 });
  const rotated = await rotateLicense(db, 'alice');
  assert.notEqual(rotated.key, first.key);
  assert.equal(rotated.license.expiresAt.toISOString(), first.license.expiresAt.toISOString());
  assert.equal(state().payments.length, 1);
  await assert.rejects(activateLicense(db, 'alice', first.key), /inválida/);
  assert.equal((await activateLicense(db, 'alice', rotated.key)).active, true);
});
