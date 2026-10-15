import { Queue } from 'bullmq';
import { config } from './config.js';

export type DispatchJob = {
  campaignId: string;
  userId: string;
  groupJid: string;
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  sequence: number;
};

const redis = new URL(config.redisUrl);
export const connection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  db: Number(redis.pathname.slice(1) || 0),
  ...(redis.protocol === 'rediss:' ? { tls: {} } : {}),
  ...(redis.username ? { username: decodeURIComponent(redis.username) } : {}),
  ...(redis.password ? { password: decodeURIComponent(redis.password) } : {})
};

export type AccountJob = { userId: string };
export const accountQueue = new Queue<AccountJob>('whatsapp-accounts-v2', {
  connection: { ...connection, maxRetriesPerRequest: 1 },
  defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: true }
});
accountQueue.on('error', () => console.error('Falha na fila de contas'));

export async function enqueueAccounts(jobs: { data: { userId: string } }[]) {
  return accountQueue.addBulk([...new Set(jobs.map(job => job.data.userId))].map(userId => ({
    name: 'account', data: { userId }, opts: { jobId: 'account-' + userId }
  })));
}
export async function reconcileAccounts(db: import('@prisma/client').PrismaClient) {
  const users = await db.messageLog.groupBy({ by: ['userId'], where: { OR: [
    { status: 'EM_ENVIO' },
    { status: 'PENDING', campaign: { status: { in: ['PENDING', 'SCHEDULED', 'PROCESSING'] } } }
  ] } });
  if (users.length) await enqueueAccounts(users.map(data => ({ data })));
}
