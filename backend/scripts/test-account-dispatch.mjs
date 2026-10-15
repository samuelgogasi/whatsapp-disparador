// Integration test: isolated schema + isolated Redis queue, fake sender only. Never imports WhatsApp.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { createAccountProcessor } from '../dist/account-dispatch.js';
import { createAccountWorker } from '../dist/account-worker.js';

const source = new URL(process.env.DATABASE_URL ?? '');
if (!source.pathname.includes('homologacao')) throw Error('Execute somente no banco de homologação');
const schema = 'dispatch_test_' + randomBytes(6).toString('hex');
const url = new URL(source); url.searchParams.set('schema',schema);
const admin = new PrismaClient();
const db = new PrismaClient({ datasourceUrl: url.href });
const redis = new URL(process.env.REDIS_URL);
const connection = { host:redis.hostname,port:Number(redis.port||6379),db:Number(redis.pathname.slice(1)||0),
  ...(redis.password?{password:decodeURIComponent(redis.password)}:{}),...(redis.username?{username:decodeURIComponent(redis.username)}:{}) };
const queue = new Queue(schema,{connection,defaultJobOptions:{removeOnComplete:true,removeOnFail:true}});
let worker;
let created = false;
let active=0,maxActive=0;const perUser=new Set(), deliveries=[], failures=[];
const settings={minMessageDelayMs:20,maxMessageDelayMs:20,groupBatchSize:2,minBatchPauseMs:50,maxBatchPauseMs:50,sendTimeoutMs:45000,dispatchConcurrency:3,dispatchMemorySoftMb:1280};
const processAccount=createAccountProcessor(db,async(data,authorize)=>{
  await authorize();
  assert.ok(!perUser.has(data.userId),'overlapping account');perUser.add(data.userId);
  active++;maxActive=Math.max(maxActive,active);deliveries.push({user:data.userId,group:data.groupJid,at:Date.now()});
  await new Promise(resolve=>setTimeout(resolve,40));
  active--;perUser.delete(data.userId);
},settings);
const start=()=>{
  worker=createAccountWorker(queue,connection,processAccount,settings);
  worker.on('error',e=>failures.push(e.message));worker.on('failed',(_job,e)=>failures.push(e.message));
  void worker.run();
};
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);created=true;
  const migrated=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{
    env:{...process.env,DATABASE_URL:url.href},encoding:'utf8',timeout:60000
  });
  if(migrated.status!==0) throw Error('Falha ao migrar schema isolado');
  for(let n=0;n<10;n++){
    const id='fixture-'+n;await db.user.create({data:{id,name:'TESTE SEM WHATSAPP',licenses:{create:{kind:'TRIAL',keyHash:'fixture-'+n,keyPrefix:'test',expiresAt:new Date('2099-01-01'),activatedAt:new Date()}}}});
    await db.campaign.create({data:{id:'campaign-'+n,userId:id,text:'Simulação local, sem envio',totalGroups:4,authorizedAt:new Date(),messageLogs:{create:Array.from({length:4},(_,i)=>({userId:id,groupJid:'fake-'+i+'@g.us'}))}}});
    await queue.add('account',{userId:id},{jobId:'account-'+id});
    await queue.add('account',{userId:id},{jobId:'account-'+id}); // deduplication must hold
  }
  assert.equal(await queue.getWaitingCount(),10);
  start();
  const deadline=Date.now()+60000;let restarted=false;
  while(await db.messageLog.count({where:{status:'ENVIADO_COM_SUCESSO'}})<40){
    if(Date.now()>deadline)throw Error('Timeout no teste');
    if(!restarted && deliveries.length>=10){await worker.close();start();restarted=true;}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  await worker.close();worker=undefined;
  assert.equal(deliveries.length,40);assert.equal(new Set(deliveries.map(d=>d.user+':'+d.group)).size,40);
  assert.ok(maxActive>1 && maxActive<=3);
  assert.equal(await db.campaign.count({where:{status:'COMPLETED'}}),10);
  assert.deepEqual(failures,[]);
  for(let n=0;n<10;n++){
    const rows=deliveries.filter(d=>d.user==='fixture-'+n);
    for(let i=1;i<rows.length;i++)assert.ok(rows[i].at-rows[i-1].at>=40+20+(i%2===0?50:0));
  }
  console.log(JSON.stringify({ok:true,accounts:10,simulatedDeliveries:40,maxConcurrent:maxActive,restarted,duplicateSends:0,whatsappSends:0}));
}finally{
  if(worker)await worker.close();
  await queue.obliterate({force:true});await queue.close();await db.$disconnect();
  if(created)await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
}
