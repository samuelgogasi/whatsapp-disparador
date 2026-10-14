import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';

test('readiness relata dependências indisponíveis sem expor credenciais', async (t) => {
  let healthy = true;
  const app = createApp({ db: {} as PrismaClient, whatsapp: { connect: async () => ({}), requestPairingCode: async () => ({}), getQr: () => null, getStatus: () => ({ connected: false, status: 'disconnected' }), listGroups: async () => [] }, enqueue: async () => [], checkReady: async () => { if (!healthy) throw new Error('postgresql://private-secret'); } });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  assert.equal((await fetch(`${base}/ready`)).status, 200);
  healthy = false; const response = await fetch(`${base}/ready`);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ok: false });
});
