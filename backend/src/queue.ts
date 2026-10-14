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

export const dispatchQueue = new Queue<DispatchJob>('whatsapp-dispatch', {
  connection: { ...connection, maxRetriesPerRequest: 1 },
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 1_000,
    removeOnFail: 2_000
  }
});

dispatchQueue.on('error', (error) => console.error('Falha na fila:', error));
