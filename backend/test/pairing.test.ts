import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WASocket } from '@whiskeysockets/baileys';
import { WhatsAppService } from '../src/whatsapp.service.js';
import { pairingSchema, withPairingTimeout } from '../src/pairing.js';

function fixture(registered = false) {
  const handlers = new Map<string, (update: any) => void>();
  let calls = 0; let created = 0;
  const socket = {
    ev: { on: (name: string, handler: (update: any) => void) => handlers.set(name, handler) },
    requestPairingCode: async (_phone: string) => { calls++; return 'ABCD1234'; },
    groupFetchAllParticipating: async () => ({'123@g.us': {id:'123@g.us',subject:'Leitores'}}),
    sendMessage: async () => ({key:{id:'sent'}})
  } as unknown as WASocket;
  const service = new WhatsAppService({ createSocket: async () => { created++; return { socket, saveCreds: async () => {}, registered }; } });
  return { service, socket, emit: (update: object) => handlers.get('connection.update')!(update), emitEvent: (name: string, update: object) => handlers.get(name)?.(update), calls: () => calls, created: () => created };
}
test('normaliza E.164 e rejeita letras, prefixo zero e comprimentos inválidos', () => {
  assert.equal(pairingSchema.parse({ phoneNumber: '+55 (11) 99999-9999' }).phoneNumber, '5511999999999');
  for (const phoneNumber of ['telefone', '0000000000', '123', '1234567890123456']) assert.equal(pairingSchema.safeParse({ phoneNumber }).success, false);
});

test('cache de grupos reúne consultas simultâneas e invalida por evento ou atualização manual', async () => {
  const state=fixture(); let fetched=0;
  state.socket.groupFetchAllParticipating=async()=>{fetched++;return {'123@g.us':{id:'123@g.us',subject:'Leitores'}} as any;};
  await state.service.connect('alice'); state.emit({connection:'open'});
  await Promise.all([state.service.listGroups('alice'),state.service.listGroups('alice')]);
  await state.service.listGroups('alice'); assert.equal(fetched,1);
  await state.service.listGroups('alice',true); assert.equal(fetched,2);
  state.emitEvent('groups.update',{}); await state.service.listGroups('alice'); assert.equal(fetched,3);
});

test('rejeição após chamar o socket é entrega incerta; autorização recusada não chama o socket', async () => {
  const state=fixture();let sends=0;
  state.socket.sendMessage=async()=>{sends++;throw Error('Conexão perdida após envio');};
  await state.service.connect('alice');state.emit({connection:'open'});
  await assert.rejects(state.service.sendMessage('alice','123@g.us','Teste'),/confirmar a entrega/);
  assert.equal(sends,1);
  await assert.rejects(state.service.sendMessage('alice','123@g.us','Teste',undefined,async()=>{throw Error('Cancelada');}),/Cancelada/);
  assert.equal(sends,1);
});

test('socket sem resposta atinge timeout sem repetir o envio', async () => {
  const handlers = new Map<string,(event:any)=>void>();let sends=0;
  const socket={ev:{on:(event:string,handler:any)=>handlers.set(event,handler)},sendMessage:()=>{sends++;return new Promise(()=>{});}} as unknown as WASocket;
  const service=new WhatsAppService({sendTimeoutMs:5,createSocket:async()=>({socket,saveCreds:async()=>{},registered:true})});
  await service.connect('alice');handlers.get('connection.update')!({connection:'open'});
  await assert.rejects(service.sendMessage('alice','123@g.us','Teste'),/confirmar a entrega/);
  assert.equal(sends,1);
});
test('aguarda sessão pronta e reúne pedidos simultâneos em um código por usuário', async () => {
  const fixtureState = fixture();
  await fixtureState.service.connect('alice');
  const first = fixtureState.service.requestPairingCode('alice', '5511999999999');
  const second = fixtureState.service.requestPairingCode('alice', '5511999999999');
  assert.equal(fixtureState.calls(), 0);
  fixtureState.emit({ qr: 'test-qr' });
  assert.equal((await first).code, 'ABCD1234');
  assert.equal((await second).code, 'ABCD1234');
  assert.equal(fixtureState.calls(), 1);
  assert.equal(fixtureState.created(), 1);
  assert.equal((await fixtureState.service.requestPairingCode('alice', '5511999999999')).code, 'ABCD1234');
  assert.equal(fixtureState.calls(), 1);
  await assert.rejects(fixtureState.service.requestPairingCode('alice', '5521999999999'), /um minuto/);
});
test('sessão conectada limpa QR/código e não gera outro pareamento', async () => {
  const state = fixture(); await state.service.connect('alice');
  const pending = state.service.requestPairingCode('alice', '5511999999999'); state.emit({ qr: 'test-qr' }); await pending;
  state.emit({ connection: 'open' });
  assert.equal(state.service.getQr('alice'), null);
  assert.deepEqual(await state.service.requestPairingCode('alice', '5511999999999'), { status: 'connected' });
  assert.equal(state.calls(), 1);
});
test('sessão já registrada reconecta sem pedir novo código', async () => {
  const state = fixture(true);
  assert.deepEqual(await state.service.requestPairingCode('alice', '5511999999999'), { status: 'connecting' });
  assert.equal(state.calls(), 0);
});
test('fechamento enquanto aguarda a conexão encerra o pedido sem código', async () => {
  const state = fixture(); await state.service.connect('alice');
  const pending = state.service.requestPairingCode('alice', '5511999999999');
  state.emit({ connection: 'close' });
  await assert.rejects(pending, /não está disponível|encerrada/);
  assert.equal(state.calls(), 0);
});
test('erro ao iniciar não deixa sessão presa e permite uma nova tentativa', async () => {
  const state = fixture(); let attempts = 0;
  const service = new WhatsAppService({ createSocket: async () => {
    if (++attempts === 1) throw new Error('Indisponível');
    return { socket: state.socket, saveCreds: async () => {}, registered: true };
  } });
  await assert.rejects(service.connect('alice'), /Indisponível/);
  assert.equal(service.getStatus('alice').status, 'disconnected');
  assert.deepEqual(await service.connect('alice'), { status: 'connecting' });
  assert.equal(attempts, 2);
});
test('espera por código é limitada e não prende a requisição indefinidamente', async () => {
  await assert.rejects(withPairingTimeout(new Promise(() => {}), 10), /demorou/);
});
