import { MessageStatus, type PrismaClient } from '@prisma/client';
import { processDispatch, recoverInterruptedDelivery } from './dispatch.js';
import { createStore } from './dispatch-store.js';
import { assertCampaignRunning, runningStatuses } from './campaigns.js';
import { requireLicense } from './licensing.js';
import { CampaignStoppedError } from './errors.js';
import type { DispatchJob } from './queue.js';

export type PacingSettings = {
  minMessageDelayMs: number; maxMessageDelayMs: number;
  groupBatchSize: number; minBatchPauseMs: number; maxBatchPauseMs: number;
  sendTimeoutMs: number;
};
export type AccountSender = (data: DispatchJob, beforeSend: () => Promise<void>) => Promise<unknown>;
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// One account token per queue; no sleeping worker and no wall-clock business-hours filter.
export function createAccountProcessor(db: PrismaClient, send: AccountSender, settings: PacingSettings, now = Date.now) {
  return async (userId: string, assertOwnership: () => Promise<void> = async () => {}): Promise<number | null> => {
    const timestamp = now();
    const pacing = await db.dispatchPacing.upsert({ where: { userId }, update: {}, create: {
      userId, nextAt: new Date(timestamp + random(settings.minMessageDelayMs, settings.maxMessageDelayMs))
    } });
    if (pacing.nextAt.getTime() > timestamp) return pacing.nextAt.getTime();
    const initial = await db.messageLog.findFirst({ where: { userId, OR: [
      { status: MessageStatus.EM_ENVIO },
      { status: MessageStatus.PENDING, campaign: { status: { in: runningStatuses }, OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date(timestamp) } }] } }
    ] }, include: { campaign: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (!initial) {
      const future = await db.messageLog.findFirst({ where: { userId, status: MessageStatus.PENDING, campaign: { status: { in: runningStatuses } } }, select: { id: true } });
      // Recheck so an immediate campaign can start while another is scheduled for the future.
      return future ? timestamp + 5000 : null;
    }
    const data: DispatchJob = { userId, campaignId: initial.campaignId, groupJid: initial.groupJid,
      text: initial.campaign.text, sequence: 0,
      ...(initial.campaign.mediaUrl ? { mediaUrl: initial.campaign.mediaUrl, mediaType: initial.campaign.mediaType ?? undefined } : {}) };
    const store = createStore(db, initial, now);
    if (await recoverInterruptedDelivery(initial.status, data, store)) return now() + 100;
    if (initial.availableAt && initial.availableAt.getTime() > timestamp) return initial.availableAt.getTime();
    let reserved = false;
    let afterSendDelay = settings.minMessageDelayMs;
    let senderError: unknown;
    try {
      await processDispatch({ data, attemptsMade: initial.attempts, opts: { attempts: 2 } }, store, async message => {
        await requireLicense(db, userId);
        await assertCampaignRunning(db, message.campaignId);
        await db.messageLog.update({ where: { id: initial.id }, data: { attempts: { increment: 1 } } });
        try {
          await send(message, async () => {
            await assertOwnership();
            // Handoff and pacing commit together; crashes leave a conservative nextAt.
            await db.$transaction(async tx => {
              await requireLicense(tx as PrismaClient, userId);
              await assertCampaignRunning(tx, message.campaignId);
              const claimed = await tx.messageLog.updateMany({ where: { id: initial.id, status: MessageStatus.PENDING,
                campaign: { status: { in: runningStatuses } } }, data: { status: MessageStatus.EM_ENVIO } });
              if (claimed.count !== 1) throw new CampaignStoppedError();
              const current = await tx.dispatchPacing.findUniqueOrThrow({ where: { userId } });
              const count = current.batchCount + 1;
              afterSendDelay = random(settings.minMessageDelayMs, settings.maxMessageDelayMs)
                + (count >= settings.groupBatchSize ? random(settings.minBatchPauseMs, settings.maxBatchPauseMs) : 0);
              await tx.dispatchPacing.update({ where: { userId }, data: {
                batchCount: count >= settings.groupBatchSize ? 0 : count,
                nextAt: new Date(now() + settings.sendTimeoutMs + afterSendDelay)
              } });
            });
            reserved = true;
          });
        } catch (error) { senderError = error; throw error; }
      });
    } catch (error) {
      // Sender failures were persisted by processDispatch. Persistence failures must be retried by the coordinator.
      if (error !== senderError) throw error;
    } finally {
      if (reserved) await db.dispatchPacing.update({ where: { userId }, data: { nextAt: new Date(now() + afterSendDelay) } });
    }
    return now() + (reserved ? afterSendDelay : 100);
  };
}
