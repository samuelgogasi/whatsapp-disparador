import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { campaignFingerprint, createCampaign, cancelCampaign, assertCampaignRunning } from '../src/campaigns.js';
import { campaignSchema } from '../src/validation.js';
import { environmentSchema } from '../src/config.js';
import { CampaignStoppedError, UncertainDeliveryError } from '../src/errors.js';
import { processDispatch, recoverInterruptedDelivery, type DispatchStore } from '../src/dispatch.js';

const input = campaignSchema.parse({ userId: 'alice', text: 'Notícia', groupJids: ['123@g.us', '456@g.us'], confirmed: true });
function database() {
  const campaigns: any[] = []; let locks = 0; let cancelledLogs = 0;
  const db: any = {
    $transaction: async (fn: (tx: any) => unknown) => fn(db),
    $queryRaw: async () => { locks++; return []; },
    campaign: {
      findFirst: async ({where}: any) => campaigns.find(c => c.userId === where.userId && (where.id ? c.id === where.id : c.fingerprint === where.fingerprint && c.createdAt >= where.createdAt.gte)) ?? null,
      findUniqueOrThrow: async ({where}: any) => campaigns.find(c => c.id === where.id),
      count: async ({where}: any) => campaigns.filter(c => c.userId === where.userId && where.status.in.includes(c.status)).length,
      create: async ({data}: any) => { const row = {id:`campaign-${campaigns.length}`, createdAt: new Date(), ...data}; campaigns.push(row); return row; },
      update: async ({where,data}: any) => Object.assign(campaigns.find(c => c.id === where.id),data)
    },
    messageLog: {updateMany: async () => { cancelledLogs++; return {count:1}; }}
  };
  return {db: db as PrismaClient, campaigns, locks:()=>locks, cancelledLogs:()=>cancelledLogs};
}
test('confirmação é obrigatória no servidor e tempos não podem ficar abaixo dos limites do piloto', () => {
  assert.equal(campaignSchema.safeParse({...input,confirmed:undefined}).success,false);
  assert.equal(campaignSchema.safeParse({...input,confirmed:false}).success,false);
  assert.equal(environmentSchema.safeParse({MIN_MESSAGE_DELAY_MS:9999}).success,false);
  assert.equal(environmentSchema.safeParse({MIN_BATCH_PAUSE_MS:59999}).success,false);
});
test('duplicata independe da ordem dos grupos, é isolada por cliente e não cria outra campanha', async () => {
  const state=database(); await createCampaign(state.db,input,2);
  await assert.rejects(createCampaign(state.db,{...input,groupJids:[...input.groupJids].reverse()},2), /já foi criada/);
  assert.equal(state.campaigns.length,1); assert.equal(state.locks(),2);
  assert.notEqual(campaignFingerprint(input),campaignFingerprint({...input,userId:'bob'}));
  state.campaigns[0].createdAt = new Date(Date.now()-11*60000);
  await createCampaign(state.db,input,2); assert.equal(state.campaigns.length,2);
});
test('limite de campanhas ativas libera vaga após cancelamento e respeita titularidade', async () => {
  const state=database(); const first=await createCampaign(state.db,input,2);
  await createCampaign(state.db,{...input,text:'Outra notícia'},2);
  await assert.rejects(createCampaign(state.db,{...input,text:'Terceira notícia'},2), /2 campanhas ativas/);
  await assert.rejects(cancelCampaign(state.db,first.id,'bob'), /não encontrada/);
  await cancelCampaign(state.db,first.id,'alice');
  assert.equal(first.status,'CANCELLED'); assert.equal(state.cancelledLogs(),1);
  await assert.rejects(assertCampaignRunning(state.db,first.id),CampaignStoppedError);
  await createCampaign(state.db,{...input,text:'Terceira notícia'},2);
});
test('entrega incerta pausa para revisão sem pedir nova tentativa; cancelamento durante espera não envia', async () => {
  let uncertain=0,failed=0,sent=0;
  const store: DispatchStore={isBlocked:async()=>false,isSent:async()=>false,processing:async()=>{},blocked:async()=>{},failed:async()=>{failed++;},sent:async()=>{sent++;},refresh:async()=>{},uncertain:async()=>{uncertain++;}};
  const job={data:{campaignId:'campaign',userId:'alice',groupJid:'123@g.us',text:'Notícia',sequence:0},attemptsMade:0,opts:{attempts:2}};
  await processDispatch(job,store,async()=>{throw new UncertainDeliveryError();});
  assert.equal(uncertain,1);assert.equal(failed,0);assert.equal(sent,0);
  await processDispatch(job,store,async()=>{throw new CampaignStoppedError();});
  assert.equal(uncertain,1);assert.equal(failed,0);assert.equal(sent,0);
  assert.equal(await recoverInterruptedDelivery('EM_ENVIO',job.data,store),true);
  assert.equal(uncertain,2);assert.equal(sent,0);
  assert.equal(await recoverInterruptedDelivery('PENDING',job.data,store),false);
});
