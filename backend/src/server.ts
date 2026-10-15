import { config } from './config.js';
import { prisma } from './db.js';
import { accountQueue, enqueueAccounts } from './queue.js';
import { whatsappService } from './whatsapp.service.js';
import { createApp } from './app.js';
import { dispatchWorker, startReconciliation } from './worker.js';

if (process.env.NODE_ENV === 'production' && (!config.publicUrl?.startsWith('https://') || !config.adminApiToken)) {
  throw new Error('Configure PUBLIC_URL com HTTPS e ADMIN_API_TOKEN para o ambiente publicado.');
}

await prisma.$connect();
await accountQueue.waitUntilReady();
const now = new Date();
const licensedUsers = await prisma.user.findMany({ where: { licenses: { some: { revokedAt: null, activatedAt: { not: null }, expiresAt: { gt: now } } } }, select: { id: true } });
await whatsappService.restore(new Set(licensedUsers.map((user) => user.id)));

const app = createApp({
  db: prisma, whatsapp: whatsappService, enqueue: enqueueAccounts,
  checkReady: async () => { await prisma.$queryRaw`SELECT 1`; await accountQueue.getWaitingCount(); }
});
const server = app.listen(config.port, config.host, () => console.log(`Backend running on http://${config.host}:${config.port}`));
void dispatchWorker.run().catch(() => { console.error('Worker encerrado por erro'); process.exitCode = 1; });
const stopReconciliation = startReconciliation();
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 60000); deadline.unref();
  server.close();
  try {
    await stopReconciliation();
    await dispatchWorker.close();
    whatsappService.close();
    await accountQueue.close();
    await prisma.$disconnect();
    clearTimeout(deadline);
  } catch { process.exitCode = 1; }
}
process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });
