import { Worker } from 'bullmq';
import { MessageStatus, CampaignStatus, type MessageLog } from '@prisma/client';
import { config } from './config.js';
import { prisma } from './db.js';
import { connection, type DispatchJob } from './queue.js';
import { randomBetween, whatsappService } from './whatsapp.service.js';
import { processDispatch, recoverInterruptedDelivery, type DispatchStore } from './dispatch.js';
import { requireLicense } from './licensing.js';
import { assertCampaignRunning, runningStatuses } from './campaigns.js';
import { CampaignStoppedError } from './errors.js';

const logKey = (data: DispatchJob) => ({ campaignId_groupJid: { campaignId: data.campaignId, groupJid: data.groupJid } });
const readyStates = new Set<MessageStatus>([MessageStatus.PENDING, MessageStatus.ENVIADO_COM_SUCESSO]);
const unfinishedStates = new Set<MessageStatus>([MessageStatus.PENDING, MessageStatus.EM_ENVIO, MessageStatus.BLOQUEADO_LICENCA, MessageStatus.AGUARDANDO_REVISAO, MessageStatus.ENTREGA_INCERTA]);
function createStore(initial: MessageLog & { campaign: { status: CampaignStatus } }): DispatchStore {
  return {
    async isBlocked() { return !runningStatuses.includes(initial.campaign.status) || !readyStates.has(initial.status); },
    async isSent() { return initial.status === MessageStatus.ENVIADO_COM_SUCESSO; },
    async processing(data) {
      await prisma.campaign.updateMany({ where: { id: data.campaignId, status: { in: [CampaignStatus.PENDING, CampaignStatus.SCHEDULED] } }, data: { status: CampaignStatus.PROCESSING } });
    },
    async blocked(data) {
      await prisma.$transaction([
        prisma.messageLog.updateMany({ where: { campaignId: data.campaignId, status: MessageStatus.PENDING }, data: { status: MessageStatus.BLOQUEADO_LICENCA, error: 'Envio bloqueado: licença ausente, vencida ou revogada.' } }),
        prisma.campaign.updateMany({ where: { id: data.campaignId, status: { in: runningStatuses } }, data: { status: CampaignStatus.PAUSED_LICENSE } })
      ]);
    },
    async uncertain(data) {
      await prisma.$transaction([
        prisma.messageLog.update({ where: logKey(data), data: { status: MessageStatus.ENTREGA_INCERTA, error: 'Confira o grupo antes de reenviar: a entrega pode ter ocorrido.' } }),
        prisma.messageLog.updateMany({ where: { campaignId: data.campaignId, status: MessageStatus.PENDING }, data: { status: MessageStatus.AGUARDANDO_REVISAO } }),
        prisma.campaign.updateMany({ where: { id: data.campaignId, status: { in: runningStatuses } }, data: { status: CampaignStatus.PAUSED_REVIEW } })
      ]);
    },
    async sent(data) { await prisma.messageLog.update({ where: logKey(data), data: { status: MessageStatus.ENVIADO_COM_SUCESSO, sentAt: new Date(), error: null } }); },
    async failed(data, reason, terminal) { await prisma.messageLog.update({ where: logKey(data), data: { status: terminal ? MessageStatus.ERRO : MessageStatus.PENDING, error: reason } }); },
    async refresh(data) {
      const counts = await prisma.messageLog.groupBy({ by: ['status'], where: { campaignId: data.campaignId }, _count: true });
      if (counts.some(row => unfinishedStates.has(row.status))) return;
      const failed = counts.some(row => row.status === MessageStatus.ERRO);
      await prisma.campaign.updateMany({ where: { id: data.campaignId, status: { in: runningStatuses } }, data: { status: failed ? CampaignStatus.PARTIAL_FAILURE : CampaignStatus.COMPLETED } });
    }
  };
}

export const dispatchWorker = new Worker<DispatchJob>('whatsapp-dispatch', async job => {
  const initial = await prisma.messageLog.findUniqueOrThrow({ where: logKey(job.data), include: { campaign: { select: { status: true } } } });
  const store = createStore(initial);
  // Recover a job interrupted after handing a message to WhatsApp without repeating it.
  if (await recoverInterruptedDelivery(initial.status, job.data, store)) return;
  return processDispatch(job, store, async data => {
    await requireLicense(prisma, data.userId);
    await assertCampaignRunning(prisma, data.campaignId);
    const pause = data.sequence > 0 && data.sequence % config.groupBatchSize === 0 ? randomBetween(config.minBatchPauseMs, config.maxBatchPauseMs) : 0;
    await new Promise(resolve => setTimeout(resolve, randomBetween(config.minMessageDelayMs, config.maxMessageDelayMs) + pause));
    await whatsappService.sendMessage(data.userId, data.groupJid, data.text,
      data.mediaUrl ? { url: data.mediaUrl, type: data.mediaType } : undefined,
      async () => {
        await requireLicense(prisma, data.userId);
        await assertCampaignRunning(prisma, data.campaignId);
        const claimed = await prisma.messageLog.updateMany({
          where: { campaignId: data.campaignId, groupJid: data.groupJid, status: MessageStatus.PENDING, campaign: { status: { in: runningStatuses } } },
          data: { status: MessageStatus.EM_ENVIO }
        });
        if (claimed.count !== 1) throw new CampaignStoppedError();
      });
  });
}, { connection, concurrency: 1, autorun: false });
dispatchWorker.on('error', () => console.error('Falha no worker de divulgação'));
