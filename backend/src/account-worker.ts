import { DelayedError, Worker, type Queue, type Job, type ConnectionOptions } from 'bullmq';
import { CampaignStoppedError } from './errors.js';
type AccountJob = { userId: string };

export function createAccountWorker(queue: Queue<AccountJob>, connection: ConnectionOptions,
  processAccount: (userId: string, assertOwnership: () => Promise<void>) => Promise<number | null>,
  settings: { dispatchConcurrency: number; dispatchMemorySoftMb: number }) {
  const busy = new Set<string>();
  async function defer(job: Job<AccountJob>, timestamp: number, token?: string): Promise<never> {
    await job.moveToDelayed(timestamp, token);
    throw new DelayedError();
  }
  return new Worker<AccountJob>(queue.name, async (job, token) => {
    const { userId } = job.data;
    if (busy.has(userId) || process.memoryUsage().rss > settings.dispatchMemorySoftMb * 1024 * 1024) {
      return defer(job, Date.now() + 5000, token);
    }
    busy.add(userId);
    try {
      const wake = await processAccount(userId, async () => {
        const redis = await queue.client;
        if (!token || await redis.get(`${queue.toKey(job.id!)}:lock`) !== token) throw new CampaignStoppedError();
      });
      if (wake !== null) return await defer(job, wake, token);
    } finally { busy.delete(userId); }
  }, { connection, concurrency: settings.dispatchConcurrency, autorun: false });
}
