import { createHash } from 'node:crypto';
import { CampaignStatus, MessageStatus, type PrismaClient, type Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { campaignSchema } from './validation.js';
import { HttpError, CampaignStoppedError } from './errors.js';

export const runningStatuses: CampaignStatus[] = [CampaignStatus.SCHEDULED, CampaignStatus.PENDING, CampaignStatus.PROCESSING];
type Input = z.infer<typeof campaignSchema>;
export const campaignFingerprint = (input: Input) => createHash('sha256').update(JSON.stringify([input.userId, input.text, [...input.groupJids].sort(), input.scheduledAt?.toISOString() ?? null])).digest('hex');

export async function createCampaign(db: PrismaClient, input: Input, maxActive: number) {
  return db.$transaction(async (tx) => {
    // Serializes creation for one customer, including across requests/processes.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`;
    const fingerprint = campaignFingerprint(input);
    const duplicate = await tx.campaign.findFirst({ where: { userId: input.userId, fingerprint, createdAt: { gte: new Date(Date.now() - 10 * 60000) } } });
    if (duplicate) throw new HttpError(409, 'Esta divulgação para os mesmos grupos já foi criada nos últimos 10 minutos. Confira o histórico antes de reenviar.');
    if (await tx.campaign.count({ where: { userId: input.userId, status: { in: runningStatuses } } }) >= maxActive) throw new HttpError(409, `Sua conta já tem ${maxActive} campanhas ativas. Aguarde a conclusão ou cancele uma delas.`);
    return tx.campaign.create({ data: {
      userId: input.userId, text: input.text, mediaUrl: input.mediaUrl, mediaType: input.mediaType,
      scheduledAt: input.scheduledAt, totalGroups: input.groupJids.length, authorizedAt: new Date(), fingerprint,
      status: input.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.PENDING,
      messageLogs: { create: input.groupJids.map(groupJid => ({ userId: input.userId, groupJid })) }
    } });
  });
}

export async function cancelCampaign(db: PrismaClient, id: string, userId: string) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const campaign = await tx.campaign.findFirst({ where: { id, userId } });
    if (!campaign) throw new HttpError(404, 'Campanha não encontrada.');
    if (campaign.status === CampaignStatus.COMPLETED || campaign.status === CampaignStatus.PARTIAL_FAILURE) throw new HttpError(409, 'Esta campanha já foi finalizada.');
    await tx.campaign.update({ where: { id }, data: { status: CampaignStatus.CANCELLED } });
    await tx.messageLog.updateMany({ where: { campaignId: id, userId, status: { in: [MessageStatus.PENDING, MessageStatus.BLOQUEADO_LICENCA, MessageStatus.AGUARDANDO_REVISAO] } }, data: { status: MessageStatus.CANCELADO } });
    return { status: CampaignStatus.CANCELLED };
  });
}

export async function assertCampaignRunning(db: PrismaClient | Prisma.TransactionClient, campaignId: string) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { status: true } });
  if (!runningStatuses.includes(campaign.status)) throw new CampaignStoppedError();
}
