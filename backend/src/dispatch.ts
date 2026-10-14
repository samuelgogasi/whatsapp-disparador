import type { DispatchJob } from './queue.js';
import { LicenseAccessError } from './errors.js';

export type DispatchStore = {
  isSent: (data: DispatchJob) => Promise<boolean>;
  isBlocked: (data: DispatchJob) => Promise<boolean>;
  blocked: (data: DispatchJob) => Promise<void>;
  processing: (data: DispatchJob) => Promise<void>;
  sent: (data: DispatchJob) => Promise<void>;
  failed: (data: DispatchJob, reason: string, terminal: boolean) => Promise<void>;
  refresh: (data: DispatchJob) => Promise<void>;
};

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
  await store.processing(job.data);
  try {
    await send(job.data);
  } catch (error) {
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
