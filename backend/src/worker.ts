import { Worker } from 'bullmq';
import { MessageStatus, CampaignStatus } from '@prisma/client';
import { config } from './config.js';
import { prisma } from './db.js';
import { connection, type DispatchJob } from './queue.js';
import { randomBetween, whatsappService } from './whatsapp.service.js';
import { processDispatch, type DispatchStore } from './dispatch.js';
import { requireLicense } from './licensing.js';

const logKey = (data: DispatchJob) => ({ campaignId_groupJid: { campaignId: data.campaignId, groupJid: data.groupJid } });
const store: DispatchStore = {
  async isBlocked(data) {
    const log = await prisma.messageLog.findUniqueOrThrow({ where: logKey(data) });
    return log.status === MessageStatus.BLOQUEADO_LICENCA;
  },
  async blocked(data) {
    await prisma.$transaction([
      prisma.messageLog.updateMany({ where: { campaignId: data.campaignId, status: MessageStatus.PENDING }, data: { status: MessageStatus.BLOQUEADO_LICENCA, error: 'Envio bloqueado: licença ausente, vencida ou revogada.' } }),
      prisma.campaign.update({ where: { id: data.campaignId }, data: { status: CampaignStatus.PAUSED_LICENSE } })
    ]);
  },
  async isSent(data) {
    const log = await prisma.messageLog.findUniqueOrThrow({ where: logKey(data) });
    return log.status === MessageStatus.ENVIADO_COM_SUCESSO;
  },
  async processing(data) {
    await prisma.campaign.update({ where: { id: data.campaignId }, data: { status: CampaignStatus.PROCESSING } });
  },
  async sent(data) {
    await prisma.messageLog.update({ where: logKey(data), data: { status: MessageStatus.ENVIADO_COM_SUCESSO, sentAt: new Date(), error: null } });
  },
  async failed(data, reason, terminal) {
    await prisma.messageLog.update({ where: logKey(data), data: { status: terminal ? MessageStatus.ERRO : MessageStatus.PENDING, error: reason } });
  },
  async refresh(data) {
    const blocked = await prisma.messageLog.count({ where: { campaignId: data.campaignId, status: MessageStatus.BLOQUEADO_LICENCA } });
    if (blocked > 0) return;
    const remaining = await prisma.messageLog.count({ where: { campaignId: data.campaignId, status: MessageStatus.PENDING } });
    if (remaining !== 0) return;
    const failed = await prisma.messageLog.count({ where: { campaignId: data.campaignId, status: MessageStatus.ERRO } });
    await prisma.campaign.update({ where: { id: data.campaignId }, data: { status: failed ? CampaignStatus.PARTIAL_FAILURE : CampaignStatus.COMPLETED } });
  }
};

export const dispatchWorker = new Worker<DispatchJob>('whatsapp-dispatch', (job) => processDispatch(job, store, async (data) => {
  await requireLicense(prisma, data.userId);
  const delay = randomBetween(config.minMessageDelayMs, config.maxMessageDelayMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
  if (job.data.sequence > 0 && job.data.sequence % config.groupBatchSize === 0) {
    await new Promise((resolve) => setTimeout(resolve, randomBetween(config.minBatchPauseMs, config.maxBatchPauseMs)));
  }

  await whatsappService.sendMessage(data.userId, data.groupJid, data.text,
    data.mediaUrl ? { url: data.mediaUrl, type: data.mediaType } : undefined,
    () => requireLicense(prisma, data.userId));
}), { connection, concurrency: 1, autorun: false });

dispatchWorker.on('error', (error) => console.error('Falha no worker:', error));
