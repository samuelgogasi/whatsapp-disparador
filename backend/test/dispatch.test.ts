import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processDispatch, type DispatchStore } from '../src/dispatch.js';
import { LicenseAccessError } from '../src/errors.js';

const data = { campaignId: 'campaign-1', userId: 'operador-1', groupJid: '123@g.us', text: 'Notícia', sequence: 0 };
function fixture() {
  const state = { status: 'PENDING', campaign: 'PENDING', sends: 0 };
  const store: DispatchStore = {
    isBlocked: async () => state.status === 'BLOCKED',
    blocked: async () => { state.status = 'BLOCKED'; state.campaign = 'PAUSED_LICENSE'; },
    isSent: async () => state.status === 'SENT',
    processing: async () => { state.campaign = 'PROCESSING'; },
    sent: async () => { state.status = 'SENT'; },
    failed: async (_data, _reason, terminal) => { state.status = terminal ? 'ERROR' : 'PENDING'; },
    refresh: async () => { if (state.status !== 'PENDING') state.campaign = state.status === 'ERROR' ? 'PARTIAL_FAILURE' : 'COMPLETED'; }
  };
  return { state, store };
}

test('falha transitória permanece pendente e sucesso na tentativa seguinte conclui campanha', async () => {
  const { state, store } = fixture();
  await assert.rejects(processDispatch({ data, attemptsMade: 0, opts: { attempts: 2 } }, store, async () => { throw new Error('Offline'); }));
  assert.equal(state.status, 'PENDING');
  assert.equal(state.campaign, 'PROCESSING');
  await processDispatch({ data, attemptsMade: 1, opts: { attempts: 2 } }, store, async () => {});
  assert.equal(state.status, 'SENT');
  assert.equal(state.campaign, 'COMPLETED');
});

test('última tentativa com erro também finaliza campanha', async () => {
  const { state, store } = fixture();
  await assert.rejects(processDispatch({ data, attemptsMade: 1, opts: { attempts: 2 } }, store, async () => { throw new Error('Offline'); }));
  assert.equal(state.status, 'ERROR');
  assert.equal(state.campaign, 'PARTIAL_FAILURE');
});

test('job reprocessado após sucesso persistido não envia novamente', async () => {
  const { state, store } = fixture();
  state.status = 'SENT';
  await processDispatch({ data, attemptsMade: 1, opts: { attempts: 2 } }, store, async () => { state.sends++; });
  assert.equal(state.sends, 0);
  assert.equal(state.campaign, 'COMPLETED');
});

test('licença vencida pausa campanha sem classificar como erro do WhatsApp ou tentar novamente', async () => {
  const { state, store } = fixture();
  await processDispatch({ data, attemptsMade: 0, opts: { attempts: 2 } }, store, async () => { throw new LicenseAccessError(); });
  assert.equal(state.status, 'BLOCKED');
  assert.equal(state.campaign, 'PAUSED_LICENSE');
  await processDispatch({ data, attemptsMade: 0, opts: { attempts: 2 } }, store, async () => { state.sends++; });
  assert.equal(state.sends, 0);
  assert.equal(state.campaign, 'PAUSED_LICENSE');
});
