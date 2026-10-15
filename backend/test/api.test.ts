import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { hashSecret } from '../src/security.js';

async function serverFixture(t: any, active = true, groups: { id: string; subject: string }[] = []) {
  let queriedUserId: string | undefined;
  let connects = 0;
  let pairingRequests = 0;
  let createdCampaign: any;
  let queuedJobs: any[] = [];
  const db = {
    $transaction: async (queries: any) => typeof queries === 'function' ? queries(db) : Promise.all(queries),
    $queryRaw: async () => [],
    authSession: { findUnique: async ({ where }: any) => where.tokenHash === hashSecret('session_test') ? { userId: 'alice', expiresAt: new Date(Date.now() + 10000) } : null },
    license: { findFirst: async () => ({ activatedAt: new Date(), revokedAt: null, expiresAt: new Date(Date.now() + (active ? 10000 : -10000)) }) },
    campaign: {
      create: async ({ data }: any) => { createdCampaign = { id: 'new-campaign', ...data }; return createdCampaign; },
      findMany: async ({ where }: any) => { queriedUserId = where.userId; return []; },
      count: async () => 0,
      findFirst: async ({ where }: any) => where.userId === 'alice' && where.id === 'own' ? { id: 'own', userId: 'alice', status: 'PENDING' } : null
    },
    messageLog: { findMany: async () => [] },
    user: { findMany: async () => [], count: async () => 0 }
  } as unknown as PrismaClient;
  const app = createApp({ db, whatsapp: {
    connect: async () => { connects++; return {}; }, getQr: () => null,
    requestPairingCode: async (userId, phoneNumber) => { pairingRequests++; return { status: 'pairing', code: 'TESTCODE', userId, phoneNumber }; },
    getStatus: () => ({ connected: false, status: 'disconnected' }), listGroups: async () => groups
  }, enqueue: async (jobs) => { queuedJobs = jobs; return []; } }, { ...config, publicUrl: undefined, pixKey: 'PIX-DE-TESTE', adminApiToken: 'test-admin-secret-32-characters-minimum' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = (url: string, options: RequestInit = {}) => fetch(`${base}${url}`, { ...options, headers: { Cookie: 'wpp_session=session_test', ...options.headers } });
  return { request, base, queriedUserId: () => queriedUserId, connects: () => connects, pairingRequests: () => pairingRequests, createdCampaign: () => createdCampaign, queuedJobs: () => queuedJobs };
}
test('API exige autenticação e lista apenas campanhas do titular mesmo com userId forjado', async (t) => {
  const { base, request, queriedUserId } = await serverFixture(t);
  assert.equal((await fetch(`${base}/api/campaigns`)).status, 401);
  assert.equal((await request('/api/campaigns?userId=bob')).status, 200);
  assert.equal(queriedUserId(), 'alice');
  assert.equal((await request('/api/campaigns/other/logs')).status, 404);
  assert.equal((await request('/api/campaigns/own/logs')).status, 200);
});
test('API impede acessar sessão de outro cliente ou criar campanha para outra conta', async (t) => {
  const { request, connects } = await serverFixture(t);
  assert.equal((await request('/api/sessions/bob/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal(connects(), 0);
  assert.equal((await request('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'bob', text: 'Notícia', groupJids: ['123@g.us'] }) })).status, 403);
});
test('licença vencida impede conexão com WhatsApp', async (t) => {
  const { request, connects } = await serverFixture(t, false);
  assert.equal((await request('/api/sessions/alice/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal(connects(), 0);
});
test('admin exige credencial própria e chave mensal exige confirmação explícita de Pix', async (t) => {
  const { request } = await serverFixture(t);
  assert.equal((await request('/api/admin/users')).status, 401);
  const headers = { Authorization: 'Bearer test-admin-secret-32-characters-minimum', 'Content-Type': 'application/json' };
  assert.equal((await request('/api/admin/users', { headers })).status, 200);
  assert.equal((await request('/api/admin/users/alice/monthly-license', { method: 'POST', headers, body: JSON.stringify({ reference: 'PIX-000001', amountCents: 9900, confirmed: false }) })).status, 400);
});
test('operações com cookie rejeitam origem externa e formulários sem JSON', async (t) => {
  const { request, connects } = await serverFixture(t);
  assert.equal((await request('/api/sessions/alice/connect', { method: 'POST', headers: { Origin: 'https://outro-site.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await request('/api/sessions/alice/connect', { method: 'POST', body: 'userId=alice' })).status, 415);
  assert.equal(connects(), 0);
});

test('cadastro e login mantêm segredos fora da resposta; logout invalida cookie e sessão', async (t) => {
  let user: any;
  const sessions: any[] = [];
  const db = {
    user: {
      create: async ({ data }: any) => { user = { id: 'alice', ...data, trialStartedAt: null, trialEndsAt: null }; return user; },
      findUnique: async ({ where }: any) => user?.email === where.email ? user : null,
      findUniqueOrThrow: async () => ({ id: user.id, name: user.name, email: user.email, trialStartedAt: null, trialEndsAt: null })
    },
    license: { findFirst: async () => null },
    authSession: {
      create: async ({ data }: any) => { sessions.push(data); return data; },
      deleteMany: async ({ where }: any) => { for (let index = sessions.length - 1; index >= 0; index--) if (where.tokenHash ? sessions[index].tokenHash === where.tokenHash : sessions[index].expiresAt <= new Date()) sessions.splice(index, 1); },
      findUnique: async ({ where }: any) => sessions.find((session) => session.tokenHash === where.tokenHash) ?? null
    }
  } as unknown as PrismaClient;
  const app = createApp({ db, whatsapp: { requestPairingCode: async () => ({}), connect: async () => ({}), getQr: () => null, getStatus: () => ({ connected: false, status: 'disconnected' }), listGroups: async () => [] }, enqueue: async () => [] }, { ...config, publicUrl: undefined });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, cookie?: string) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  const response = await post('/api/auth/register', { name: 'Redação Alice', email: ' ALICE@EXAMPLE.COM ', password: 'senha-segura-123' });
  assert.equal(response.status, 201);
  const contents = await response.text();
  assert.equal(contents.includes('password'), false);
  assert.equal(user.email, 'alice@example.com');
  assert.match(user.passwordHash, /^scrypt:/);
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const sessionCookieValue = cookie.split(';')[0]!;
  assert.equal(JSON.stringify(sessions).includes(sessionCookieValue.split('=')[1]!), false);
  assert.equal((await fetch(`${base}/api/me`, { headers: { Cookie: sessionCookieValue } })).status, 200);
  assert.equal((await post('/api/auth/login', { email: 'alice@example.com', password: 'senha-errada-123' })).status, 401);
  assert.equal((await post('/api/auth/login', { email: 'alice@example.com', password: 'senha-segura-123' })).status, 200);
  assert.equal((await post('/api/auth/logout', {}, sessionCookieValue)).status, 200);
  assert.equal((await fetch(`${base}/api/me`, { headers: { Cookie: sessionCookieValue } })).status, 401);
});

test('agendamento persiste data UTC e mantém jobs adiados até o início previsto', async (t) => {
  const fixture = await serverFixture(t, true, [{ id: '123@g.us', subject: 'Leitores' }]);
  const scheduledAt = new Date(Date.now() + 10 * 60000).toISOString();
  const before = Date.now();
  const response = await fixture.request('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Matéria agendada', groupJids: ['123@g.us'], confirmed: true, scheduledAt }) });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).scheduledAt, scheduledAt);
  assert.equal(fixture.createdCampaign().status, 'SCHEDULED');
  assert.equal(fixture.createdCampaign().scheduledAt.toISOString(), scheduledAt);
  const delay = fixture.queuedJobs()[0].opts.delay;
  assert.ok(delay <= new Date(scheduledAt).getTime() - before);
  assert.ok(delay >= new Date(scheduledAt).getTime() - Date.now());
  assert.equal(fixture.queuedJobs()[0].data.userId, 'alice');
});
test('envio imediato mantém delay zero; data passada é rejeitada sem criar campanha', async (t) => {
  const fixture = await serverFixture(t, true, [{ id: '123@g.us', subject: 'Leitores' }]);
  const post = (body: object) => fixture.request('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true, ...body }) });
  assert.equal((await post({ text: 'Matéria', groupJids: ['123@g.us'], scheduledAt: '2000-01-01T00:00:00Z' })).status, 400);
  assert.equal(fixture.createdCampaign(), undefined);
  assert.equal((await post({ text: 'Matéria', groupJids: ['123@g.us'] })).status, 202);
  assert.equal(fixture.createdCampaign().status, 'PENDING');
  assert.equal(fixture.queuedJobs()[0].opts.delay, 0);
});
test('chave Pix pessoal não aparece na rota pública e seus dados exigem login', async (t) => {
  const fixture = await serverFixture(t);
  const contents = await (await fetch(`${fixture.base}/api/public`)).json();
  assert.equal('pixKey' in contents, false);
  assert.equal((await fetch(`${fixture.base}/api/payment-info`)).status, 401);
  assert.equal((await (await fixture.request('/api/payment-info')).json()).pixKey, 'PIX-DE-TESTE');
});

test('código exige login, licença e titularidade; normaliza número e rejeita dados inválidos', async (t) => {
  const fixture = await serverFixture(t);
  const options = (phoneNumber: string) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber }) });
  assert.equal((await fetch(`${fixture.base}/api/sessions/alice/pairing-code`, options('+55 11 99999-9999'))).status, 401);
  assert.equal((await fixture.request('/api/sessions/bob/pairing-code', options('+55 11 99999-9999'))).status, 403);
  assert.equal((await fixture.request('/api/sessions/alice/pairing-code', options('telefone'))).status, 400);
  const response = await fixture.request('/api/sessions/alice/pairing-code', options('+55 (11) 99999-9999'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).phoneNumber, '5511999999999');
  assert.equal(fixture.pairingRequests(), 1);
  const expired = await serverFixture(t, false);
  assert.equal((await expired.request('/api/sessions/alice/pairing-code', options('+55 11 99999-9999'))).status, 403);
  assert.equal(expired.pairingRequests(), 0);
});
