import type { DispatchJob } from './queue.js';
import { LicenseAccessError, CampaignStoppedError, UncertainDeliveryError } from './errors.js';

export type DispatchStore = {
  isSent: (data: DispatchJob) => Promise<boolean>;
  isBlocked: (data: DispatchJob) => Promise<boolean>;
  blocked: (data: DispatchJob) => Promise<void>;
  processing: (data: DispatchJob) => Promise<void>;
  sent: (data: DispatchJob) => Promise<void>;
  failed: (data: DispatchJob, reason: string, terminal: boolean) => Promise<void>;
  refresh: (data: DispatchJob) => Promise<void>;
  uncertain?: (data: DispatchJob) => Promise<void>;
};

export async function recoverInterruptedDelivery(status: string, data: DispatchJob, store: DispatchStore) {
  if (status !== 'EM_ENVIO') return false;
  if (!store.uncertain) throw new Error('Revisão de entrega não configurada');
  await store.uncertain(data);
  return true;
}

// Dependências explícitas permitem testar tentativas sem Redis ou WhatsApp.
export async function processDispatch(
  job: { data: DispatchJob; attemptsMade: number; opts: { attempts?: number } },
  store: DispatchStore,
  send: (data: DispatchJob) => Promise<unknown>
) {
  if (await store.isBlocked(job.data)) return;
  if (await store.isSent(job.data)) {
    await store.refresh(job.data);
    return;
  }
  try {
    await store.processing(job.data);
    await send(job.data);
  } catch (error) {
    if (error instanceof CampaignStoppedError) return;
    if (error instanceof UncertainDeliveryError) {
      if (store.uncertain) await store.uncertain(job.data);
      else await store.failed(job.data, error.message, true);
      return; // Never automatically repeat a possibly delivered message.
    }
    if (error instanceof LicenseAccessError) {
      await store.blocked(job.data);
      return;
    }
    const terminal = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const reason = error instanceof Error ? error.message : 'Falha desconhecida no envio';
    await store.failed(job.data, reason, terminal);
    if (terminal) await store.refresh(job.data);
    throw error;
  }
  // Falhas de persistência não são registradas como rejeição do WhatsApp.
  await store.sent(job.data);
  await store.refresh(job.data);
}
