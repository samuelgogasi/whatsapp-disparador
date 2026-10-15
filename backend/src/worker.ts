import { config } from './config.js';
import { prisma } from './db.js';
import { accountQueue, connection, reconcileAccounts } from './queue.js';
import { whatsappService } from './whatsapp.service.js';
import { createAccountProcessor } from './account-dispatch.js';
import { createAccountWorker } from './account-worker.js';

const processAccount = createAccountProcessor(prisma, (data, beforeSend) => whatsappService.sendMessage(
  data.userId, data.groupJid, data.text,
  data.mediaUrl ? { url: data.mediaUrl, type: data.mediaType } : undefined, beforeSend
), config);
export const dispatchWorker = createAccountWorker(accountQueue, connection, processAccount, config);
dispatchWorker.on('error', () => console.error('Falha no worker de divulgação'));
dispatchWorker.on('failed', () => console.error('Coordenação interrompida; será reconciliada com o banco.'));

export function startReconciliation() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: Promise<void> = Promise.resolve();
  const tick = () => {
    current = reconcileAccounts(prisma).catch(() => { console.error('Falha ao reconciliar contas de divulgação'); }).finally(() => {
      if (!stopped) { timer = setTimeout(tick, 5000); timer.unref(); }
    });
  };
  tick();
  return async () => { stopped = true; if (timer) clearTimeout(timer); await current; };
}
