import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { createAccountProcessor, type AccountSender } from '../src/account-dispatch.js';
import { UncertainDeliveryError } from '../src/errors.js';

const settings = { minMessageDelayMs: 10000, maxMessageDelayMs: 10000, groupBatchSize: 30,
  minBatchPauseMs: 60000, maxBatchPauseMs: 60000, sendTimeoutMs: 45000 };
const running = ['SCHEDULED','PENDING','PROCESSING'];
function fixture() {
  let time = Date.parse('2026-10-15T05:00:00Z'); // 02:00 in Brasília: no business-hours restriction.
  const pacings = new Map<string, any>();
  const campaigns: any[] = [], logs: any[] = [];
  const disabled = new Set<string>();
  let failSent = false;
  const apply = (row: any, data: any) => { for (const [key,value] of Object.entries(data)) row[key] = value && typeof value === 'object' && 'increment' in value ? (row[key] ?? 0) + (value as any).increment : value; return structuredClone(row); };
  const matches = (row: any, where: any): boolean => !where || Object.entries(where).every(([key,value]: any) => {
    if (key === 'OR') return value.some((condition: any) => matches(row, condition));
    if (key === 'campaign') return matches(row.campaign, value);
    if (key === 'campaignId_groupJid') return matches(row, value);
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      if ('lte' in value) return row[key] <= value.lte;
    }
    return row[key] === value;
  });
  const db: any = {
    $transaction: async (work: any) => {
      if (typeof work !== 'function') return Promise.all(work);
      const snapshot = { logs: structuredClone(logs), pacing: structuredClone(pacings) };
      try { return await work(db); } catch (e) {
        logs.splice(0, logs.length, ...snapshot.logs.map((l: any) => ({ ...l, campaign: campaigns.find(c => c.id === l.campaignId) })));
        pacings.clear(); for (const [k,v] of snapshot.pacing) pacings.set(k,v);
        throw e;
      }
    },
    license: { findFirst: async ({ where }: any) => disabled.has(where.userId) ? null : { activatedAt: new Date(0), revokedAt: null, expiresAt: new Date('2099-01-01') } },
    dispatchPacing: {
      upsert: async ({ where, create }: any) => { if (!pacings.has(where.userId)) pacings.set(where.userId,{ batchCount: 0, ...create }); return structuredClone(pacings.get(where.userId)); },
      findUniqueOrThrow: async ({ where }: any) => structuredClone(pacings.get(where.userId)),
      update: async ({ where,data }: any) => apply(pacings.get(where.userId),data)
    },
    messageLog: {
      findFirst: async ({ where }: any) => { const found = logs.find(l => matches(l,where)); return found ? structuredClone(found) : null; },
      update: async ({ where,data }: any) => { if (failSent && data.status === 'ENVIADO_COM_SUCESSO') throw Error('database unavailable'); return apply(logs.find(l => matches(l,where)),data); },
      updateMany: async ({ where,data }: any) => { const rows = logs.filter(l => matches(l,where)); rows.forEach(l => apply(l,data)); return { count: rows.length }; },
      groupBy: async ({ where }: any) => [...new Set(logs.filter(l => matches(l,where)).map(l => l.status))].map(status => ({ status }))
    },
    campaign: {
      findUniqueOrThrow: async ({ where }: any) => structuredClone(campaigns.find(c => matches(c,where))),
      updateMany: async ({ where,data }: any) => { const rows = campaigns.filter(c => matches(c,where)); rows.forEach(c => apply(c,data)); return { count: rows.length }; }
    }
  };
  const add = (userId: string, count: number, scheduledAt: Date | null = null) => {
    const campaign = { id: 'c'+campaigns.length,userId,status:scheduledAt ? 'SCHEDULED':'PENDING',scheduledAt,text:'simulated',mediaUrl:null };
    campaigns.push(campaign);
    for(let i=0;i<count;i++) logs.push({ id:'m'+logs.length, userId,campaignId:campaign.id,groupJid:i+'@g.us',status:'PENDING',attempts:0,availableAt:null,campaign });
    return campaign;
  };
  return { db: db as PrismaClient, add, logs, campaigns, pacings, disabled, now: () => time, setTime: (v: number) => { time=v; }, breakPersistence: () => { failSent=true; } };
}

test('10 contas × 500 destinos avançam por conta, sem esperar a campanha anterior; contador e pausa persistem', async () => {
  const f=fixture(); const sends: {user:string,time:number}[]=[];
  for(let i=0;i<10;i++) f.add('u'+i,500);
  const sender: AccountSender = async (d, authorize) => { await authorize(); sends.push({user:d.userId,time:f.now()}); };
  let processor=createAccountProcessor(f.db,sender,settings,f.now);
  const wake=new Map<string,number>();
  for(let i=0;i<10;i++) wake.set('u'+i,(await processor('u'+i))!);
  let turns=0;
  while(wake.size) {
    const [user,at]=[...wake.entries()].sort((a,b)=>a[1]-b[1])[0]!;
    f.setTime(at); const next=await processor(user);
    if(next===null)wake.delete(user);else wake.set(user,next);
    if(++turns===150) processor=createAccountProcessor(f.db,sender,settings,f.now); // simulated process restart
    assert.ok(turns<5100);
  }
  assert.equal(sends.length,5000);
  assert.equal(new Set(sends.slice(0,10).map(s=>s.user)).size,10);
  for(let i=0;i<10;i++) {
    const times=sends.filter(s=>s.user==='u'+i).map(s=>s.time);
    for(let n=1;n<times.length;n++) assert.equal(times[n]!-times[n-1]!,n%30===0?70000:10000);
  }
  assert.ok(f.campaigns.every(c=>c.status==='COMPLETED'));
});

test('campanhas de uma conta compartilham a pausa; agendamento futuro não impede campanha imediata', async()=>{
  const f=fixture(); f.add('a',1,new Date(f.now()+86400000));f.add('a',30);f.add('a',1);
  let sends=0;const p=createAccountProcessor(f.db,async(_d,auth)=>{await auth();sends++;},settings,f.now);
  f.setTime((await p('a'))!);
  for(let i=0;i<30;i++){const start=f.now();const next=(await p('a'))!;assert.equal(next-start,i===29?70000:10000);f.setTime(next);}
  assert.equal(sends,30);await p('a');assert.equal(sends,31);assert.equal(f.campaigns[0].status,'SCHEDULED');
});

test('cancelamento e licença vencida antes da transmissão não enviam nem consomem lote',async()=>{
  for(const kind of ['cancel','expired']) {
    const f=fixture();const campaign=f.add('a',2);let sends=0;
    const p=createAccountProcessor(f.db,async(_d,auth)=>{
      if(kind==='cancel')campaign.status='CANCELLED';else f.disabled.add('a');
      await auth();sends++;
    },settings,f.now);
    f.setTime((await p('a'))!);await p('a');assert.equal(sends,0);assert.equal(f.pacings.get('a').batchCount,0);
  }
});

test('falha anterior ao socket tem duas tentativas e espera persistida; outra conta continua',async()=>{
  const f=fixture();f.add('a',1);f.add('b',1);let failures=0;
  const p=createAccountProcessor(f.db,async(d,auth)=>{if(d.userId==='a'){failures++;throw Error('disconnected');}await auth();},settings,f.now);
  const first=(await p('a'))!;await p('b');f.setTime(first);await p('a');await p('b');
  assert.equal(f.campaigns[1].status,'COMPLETED');assert.equal(failures,1);
  const retry=(await p('a'))!;assert.equal(retry,f.now()+30000);f.setTime(retry);await p('a');
  assert.equal(failures,2);assert.equal(f.logs[0].status,'ERRO');assert.equal(f.campaigns[0].status,'PARTIAL_FAILURE');
});

test('entrega incerta pausa campanha e falha de persistência após envio é recuperada sem repetição',async()=>{
  for(const kind of ['timeout','database']) {
    const f=fixture();f.add('a',2);let sends=0;
    const send: AccountSender=async(_d,auth)=>{await auth();sends++;if(kind==='timeout')throw new UncertainDeliveryError();f.breakPersistence();};
    let p=createAccountProcessor(f.db,send,settings,f.now);f.setTime((await p('a'))!);
    if(kind==='database')await assert.rejects(p('a'),/database/);else await p('a');
    f.setTime(f.now()+100000);p=createAccountProcessor(f.db,send,settings,f.now);await p('a');
    assert.equal(sends,1);assert.equal(f.logs[0].status,'ENTREGA_INCERTA');assert.equal(f.logs[1].status,'AGUARDANDO_REVISAO');
  }
});
