import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { adminListSchema, adminUserFilter } from '../src/admin.js';

test('paginação e filtros têm limites e distinguem chaves históricas de licença corrente', () => {
  assert.equal(adminListSchema.parse({}).pageSize, 20);
  for (const query of [{ page: 0 }, { pageSize: 1000 }, { licenseState: 'unknown' }]) assert.equal(adminListSchema.safeParse(query).success, false);
  const active = JSON.stringify(adminUserFilter(adminListSchema.parse({ licenseState: 'active' })));
  assert.ok(active.includes('"revokedAt":null'));
  assert.ok(active.includes('"activatedAt":{"not":null}'));
  const revoked = adminUserFilter(adminListSchema.parse({ licenseState: 'revoked' }));
  assert.ok(JSON.stringify(revoked).includes('"none":{"revokedAt":null}'));
});

test('admin pagina mais de 100 clientes, consulta pagamentos e tem totais globais', async (t) => {
  const users = Array.from({ length: 125 }, (_, index) => ({ id: `user-${index + 1}`, name: `Cliente ${index + 1}`, email: `cliente${index + 1}@example.com`, licenses: [] }));
  let selection: any;
  const db = {
    $transaction: async (queries: Promise<unknown>[]) => Promise.all(queries),
    user: {
      count: async () => users.length,
      findMany: async (input: any) => { selection = input.select; return users.slice(input.skip, input.skip + input.take); }
    },
    license: { count: async (input: any) => input?.where?.kind === 'TRIAL' ? 2 : input?.where?.kind === 'MONTHLY' ? 3 : input?.where?.activatedAt?.not === null ? 5 : input?.where?.activatedAt === null ? 4 : input?.where?.expiresAt?.lte ? 10 : input?.where?.revokedAt?.not === null ? 12 : 31 },
    manualPayment: { count: async () => 1, aggregate: async () => ({ _sum: { amountCents: 9900 } }), findMany: async () => [{ id: 'pix-1', amountCents: 9900, reference: 'TEST-PIX', user: { id: 'user-125' }, license: { keyPrefix: 'wpp_prefix' } }] }
  } as unknown as PrismaClient;
  const app = createApp({ db, whatsapp: { connect: async () => ({}), requestPairingCode: async () => ({}), getQr: () => null, getStatus: () => ({ connected: false, status: 'disconnected' }), listGroups: async () => [] }, enqueue: async () => [] }, { ...config, adminApiToken: 'test-admin-secret-at-least-32-characters', publicUrl: undefined });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = (path: string) => fetch(`${base}${path}`, { headers: { 'X-Admin-Token': 'test-admin-secret-at-least-32-characters' } });
  assert.equal((await fetch(`${base}/api/admin/overview`)).status, 401);
  const page = await (await get('/api/admin/users?page=7&pageSize=20')).json();
  assert.equal(page.total, 125); assert.equal(page.items.length, 5); assert.equal(page.items[4].id, 'user-125');
  assert.equal(selection.passwordHash, undefined); assert.equal(selection.licenses.select.keyHash, undefined);
  const overview = await (await get('/api/admin/overview')).json();
  assert.equal(overview.clients, 125); assert.equal(overview.activeLicenses, 5); assert.equal(overview.issuedKeys, 31); assert.equal(overview.confirmedAmountCents, 9900);
  assert.equal((await (await get('/api/admin/payments?userId=user-125')).json()).items[0].reference, 'TEST-PIX');
  assert.equal((await get('/api/admin/users?pageSize=1000')).status, 400);
});
