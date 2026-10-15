import { MessageStatus, CampaignStatus, type MessageLog, type PrismaClient } from '@prisma/client';
import type { DispatchJob } from './queue.js';
import type { DispatchStore } from './dispatch.js';
import { runningStatuses } from './campaigns.js';

const logKey = (data: DispatchJob) => ({ campaignId_groupJid: { campaignId: data.campaignId, groupJid: data.groupJid } });
const readyStates = new Set<MessageStatus>([MessageStatus.PENDING, MessageStatus.ENVIADO_COM_SUCESSO]);
const unfinishedStates = new Set<MessageStatus>([MessageStatus.PENDING, MessageStatus.EM_ENVIO, MessageStatus.BLOQUEADO_LICENCA, MessageStatus.AGUARDANDO_REVISAO, MessageStatus.ENTREGA_INCERTA]);
export function createStore(db: PrismaClient, initial: MessageLog & { campaign: { status: CampaignStatus } }, now = Date.now): DispatchStore {
  return {
    async isBlocked() { return !runningStatuses.includes(initial.campaign.status) || !readyStates.has(initial.status); },
    async isSent() { return initial.status === MessageStatus.ENVIADO_COM_SUCESSO; },
    async processing(data) {
      await db.campaign.updateMany({ where: { id: data.campaignId, status: { in: [CampaignStatus.PENDING, CampaignStatus.SCHEDULED] } }, data: { status: CampaignStatus.PROCESSING } });
    },
    async blocked(data) {
      await db.$transaction([
        db.messageLog.updateMany({ where: { campaignId: data.campaignId, status: MessageStatus.PENDING }, data: { status: MessageStatus.BLOQUEADO_LICENCA, error: 'Envio bloqueado: licença ausente, vencida ou revogada.' } }),
        db.campaign.updateMany({ where: { id: data.campaignId, status: { in: runningStatuses } }, data: { status: CampaignStatus.PAUSED_LICENSE } })
      ]);
    },
    async uncertain(data) {
      await db.$transaction([
        db.messageLog.update({ where: logKey(data), data: { status: MessageStatus.ENTREGA_INCERTA, error: 'Confira o grupo antes de reenviar: a entrega pode ter ocorrido.' } }),
        db.messageLog.updateMany({ where: { campaignId: data.campaignId, status: MessageStatus.PENDING }, data: { status: MessageStatus.AGUARDANDO_REVISAO } }),
        db.campaign.updateMany({ where: { id: data.campaignId, status: { in: runningStatuses } }, data: { status: CampaignStatus.PAUSED_REVIEW } })
      ]);
    },
    async sent(data) { await db.messageLog.update({ where: logKey(data), data: { status: MessageStatus.ENVIADO_COM_SUCESSO, sentAt: new Date(now()), error: null } }); },
    async failed(data, reason, terminal) { await db.messageLog.update({ where: logKey(data), data: { status: terminal ? MessageStatus.ERRO : MessageStatus.PENDING, error: reason, availableAt: terminal ? null : new Date(now() + 30000) } }); },
    async refresh(data) {
      const counts = await db.messageLog.groupBy({ by: ['status'], where: { campaignId: data.campaignId }, _count: true });
      if (counts.some(row => unfinishedStates.has(row.status))) return;
      const failed = counts.some(row => row.status === MessageStatus.ERRO);
      await db.campaign.updateMany({ where: { id: data.campaignId, status: { in: runningStatuses } }, data: { status: failed ? CampaignStatus.PARTIAL_FAILURE : CampaignStatus.COMPLETED } });
    }
  };
}

