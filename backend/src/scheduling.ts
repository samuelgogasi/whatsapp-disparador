import type { DispatchJob } from './queue.js';

export type EnqueuedDispatch = { name: string; opts: { jobId: string; delay: number }; data: DispatchJob };

// Calculado depois de persistir a campanha: o tempo gasto no banco não prolonga a agenda.
export function buildCampaignJobs(input: {
  id: string; userId: string; text: string; groupJids: string[];
  mediaUrl?: string; mediaType?: string; scheduledAt?: Date;
}, now = Date.now()): EnqueuedDispatch[] {
  const delay = input.scheduledAt ? Math.max(0, input.scheduledAt.getTime() - now) : 0;
  return input.groupJids.map((groupJid, sequence) => ({
    name: `campaign-${input.id}-${sequence}`,
    opts: { jobId: `campaign-${input.id}-${sequence}`, delay },
    data: { campaignId: input.id, userId: input.userId, groupJid, text: input.text, mediaUrl: input.mediaUrl, mediaType: input.mediaType, sequence }
  }));
}
