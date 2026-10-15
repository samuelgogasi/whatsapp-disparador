// Run from /app in the staging container. Never imports the WhatsApp service.
import { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { processDispatch } from '../dist/dispatch.js';

const database = new URL(process.env.DATABASE_URL ?? '');
if (database.hostname !== 'postgres' || database.pathname !== '/whatsapp_homologacao') throw Error('Staging database required');
database.searchParams.set('connection_limit', '2');
const redis = new URL(process.env.REDIS_URL ?? '');
if (redis.hostname !== 'redis') throw Error('Internal staging Redis required');
const connection = { host: redis.hostname, port: Number(redis.port || 6379), maxRetriesPerRequest: null };
const id = `simulation500_${randomBytes(6).toString('hex')}`;
const schema = `"${id}"`;
const db = new PrismaClient({ datasourceUrl: database.href });
const queue = new Queue(id, { connection });
const report = { id, simulatedOnly: true, realWhatsAppSends: 0, groups: 500, messageBytes: 1024, concurrency: 1, fakeSendDelayMs: 100, samples: [] };
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let worker, sampler, phase = 'baseline', done = 0, failure;
const cpuStart = process.cpuUsage();
const started = performance.now();
const read = (path) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
function sample() {
  const memory = Number(read('/sys/fs/cgroup/memory.current')) || null;
  const inactive = Number(read('/sys/fs/cgroup/memory.stat').match(/^inactive_file (\d+)/m)?.[1] ?? 0);
  const available = Number(read('/proc/meminfo').match(/^MemAvailable:\s+(\d+)/m)?.[1] ?? 0) * 1024;
  const cpu = Number(read('/sys/fs/cgroup/cpu.stat').match(/^usage_usec (\d+)/m)?.[1] ?? 0);
  const proc = process.memoryUsage();
  report.samples.push({ phase, elapsedMs: Math.round(performance.now() - started), done, containerBytes: memory, containerWorkingSetBytes: memory === null ? null : memory - inactive, processRssBytes: proc.rss, hostAvailableBytes: available || null, containerCpuUsec: cpu });
}
const query = (sql, ...params) => db.$queryRawUnsafe(sql, ...params);
const exec = (sql, ...params) => db.$executeRawUnsafe(sql, ...params);
const status = async (data) => (await query(`SELECT status FROM ${schema}.messages WHERE group_id=$1`, data.groupJid))[0]?.status;
async function license() { const rows = await query(`SELECT active FROM ${schema}.licenses WHERE id=$1`, 'simulated-user'); if (!rows[0]?.active) throw Error('Simulation license missing'); }
const store = {
  isBlocked: async data => (await status(data)) === 'BLOCKED',
  isSent: async data => (await status(data)) === 'SENT',
  processing: async () => { await exec(`UPDATE ${schema}.campaigns SET status='PROCESSING' WHERE id=$1`, id); },
  sent: async data => { await exec(`UPDATE ${schema}.messages SET status='SENT', sent_at=now() WHERE group_id=$1`, data.groupJid); },
  blocked: async () => { throw Error('Unexpected license block'); },
  failed: async (data, reason) => { await exec(`UPDATE ${schema}.messages SET status='ERROR' WHERE group_id=$1`, data.groupJid); },
  refresh: async () => {
    if (Number((await query(`SELECT count(*) AS n FROM ${schema}.messages WHERE status='BLOCKED'`))[0].n)) return;
    if (Number((await query(`SELECT count(*) AS n FROM ${schema}.messages WHERE status='PENDING'`))[0].n)) return;
    const failed = Number((await query(`SELECT count(*) AS n FROM ${schema}.messages WHERE status='ERROR'`))[0].n);
    await exec(`UPDATE ${schema}.campaigns SET status=$1 WHERE id=$2`, failed ? 'FAILED' : 'COMPLETED', id);
  }
};
try {
  await db.$connect(); await queue.waitUntilReady();
  const client = await queue.client;
  const redisMemory = async () => Number((await client.info()).match(/^used_memory:(\d+)/m)?.[1] ?? 0);
  report.redisBeforeBytes = await redisMemory();
  sample(); sampler = setInterval(sample, 1000);
  console.log('SIMULATION baseline 15s; no WhatsApp socket or real destination is used');
  await wait(15000);
  phase = 'enqueue';
  await exec(`CREATE SCHEMA ${schema}`);
  await exec(`CREATE TABLE ${schema}.campaigns (id text PRIMARY KEY, status text NOT NULL, message text NOT NULL)`);
  await exec(`CREATE TABLE ${schema}.licenses (id text PRIMARY KEY, active boolean NOT NULL)`);
  await exec(`CREATE TABLE ${schema}.messages (group_id text PRIMARY KEY, status text NOT NULL, sent_at timestamptz)`);
  await exec(`CREATE INDEX ON ${schema}.messages(status)`);
  const text = 'SIMULATION ONLY - NO MESSAGE SENT https://example.com/noticia '.padEnd(1024, '.');
  await exec(`INSERT INTO ${schema}.campaigns VALUES ($1,'PENDING',$2)`, id, text);
  await exec(`INSERT INTO ${schema}.licenses VALUES ($1,true)`, 'simulated-user');
  await exec(`INSERT INTO ${schema}.messages SELECT 'simulation-' || n, 'PENDING', NULL FROM generate_series(1,500) n`);
  const enqueueStart = performance.now();
  await queue.addBulk(Array.from({length:500}, (_, sequence) => ({ name: 'simulate', data: { campaignId: id, userId: 'simulated-user', groupJid: `simulation-${sequence + 1}`, text, sequence }, opts: { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 } })));
  report.enqueueMs = Math.round(performance.now() - enqueueStart);
  report.redisQueuedBytes = await redisMemory();
  console.log('SIMULATION queued=500; holding queue 15s for resource measurement');
  phase = 'queued'; await wait(15000); phase = 'processing';
  const processingStart = performance.now();
  worker = new Worker(id, async job => {
    await processDispatch(job, store, async () => { await license(); await wait(100); await license(); });
    done++;
    if (done % 100 === 0) console.log(`SIMULATION processed=${done}/500`);
  }, { connection, concurrency: 1 });
  worker.on('failed', () => { failure = 'A simulated task failed'; });
  worker.on('error', () => { failure = 'Simulation worker error'; });
  while (done < 500 && !failure) { if (performance.now() - started > 180000) throw Error('Simulation deadline'); await wait(250); }
  if (failure) throw Error(failure);
  report.processingMs = Math.round(performance.now() - processingStart);
  report.databaseSentRows = Number((await query(`SELECT count(*) AS n FROM ${schema}.messages WHERE status='SENT'`))[0].n);
  report.queueCounts = await queue.getJobCounts('completed', 'failed', 'waiting', 'active');
  report.redisAfterProcessingBytes = await redisMemory();
  report.tempTableBytes = Number((await query(`SELECT sum(pg_total_relation_size(c.oid))::bigint AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r'`, id))[0].n);
  phase = 'cooldown'; await wait(15000);
  report.ok = report.databaseSentRows === 500 && report.queueCounts.completed === 500 && report.queueCounts.failed === 0;
} catch (error) {
  report.ok = false; report.error = error instanceof Error ? error.message : 'Simulation failed';
} finally {
  if (sampler) clearInterval(sampler); sample();
  if (worker) await worker.close();
  // Only the unique queue/schema created by this invocation can be removed.
  if (!/^simulation500_[a-f0-9]{12}$/.test(id)) throw Error('Invalid cleanup scope');
  await queue.obliterate({ force: true });
  await exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  report.schemaRemoved = !(await query('SELECT 1 FROM pg_namespace WHERE nspname=$1', id)).length;
  let cursor = '0'; report.queueKeysRemaining = 0;
  do {
    const page = await (await queue.client).scan(cursor, { MATCH: `bull:${id}:*`, COUNT: 100 });
    cursor = String(page[0]); report.queueKeysRemaining += page[1].length;
  } while (cursor !== '0');
  await queue.close(); await db.$disconnect();
  report.totalMs = Math.round(performance.now() - started);
  report.processCpuMs = Object.values(process.cpuUsage(cpuStart)).reduce((a,b)=>a+b,0) / 1000;
  report.processMaxRssBytes = process.resourceUsage().maxRSS * 1024;
  report.containerWorkingSetPeakBytes = Math.max(...report.samples.map(x=>x.containerWorkingSetBytes ?? 0));
  console.log('SIMULATION_RESULT ' + JSON.stringify({...report,samples:undefined}));
  writeFileSync('/tmp/simulation500-report.json', JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
