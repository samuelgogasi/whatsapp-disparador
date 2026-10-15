import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { userIdSchema } from './validation.js';
import { pairingSchema, withPairingTimeout } from './pairing.js';
import { HttpError, UncertainDeliveryError } from './errors.js';

type Session = {
  socket?: WASocket; qr?: string; connected: boolean; registered: boolean;
  ready: Promise<boolean>; resolveReady: (ready: boolean) => void;
  pairing?: { phoneNumber: string; code: string; refreshAt: number };
  pairingPhone?: string; pairingRequest?: Promise<{ status: string; code?: string; refreshAfterSeconds?: number }>;
};
type WhatsAppDependencies = {
  createSocket: (userId: string) => Promise<{ socket: WASocket; saveCreds: () => Promise<void>; registered: boolean }>;
  sendTimeoutMs?: number;
};

const defaultDependencies: WhatsAppDependencies = {
  async createSocket(userId) {
    const authPath = path.join(config.authDir, userId);
    await mkdir(authPath, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion({ timeout: 10000 });
    return { socket: makeWASocket({ auth: state, version, logger: pino({ level: 'silent' }), syncFullHistory: false, shouldSyncHistoryMessage: () => false, markOnlineOnConnect: false }), saveCreds, registered: Boolean(state.creds.registered) };
  }
};

export type WhatsAppGroup = { id: string; subject: string };

export class WhatsAppService {
  private readonly sessions = new Map<string, Session>();
  private readonly connecting = new Map<string, Promise<unknown>>();
  private stopping = false;
  private readonly groupCache = new Map<string, { expires: number; groups: WhatsAppGroup[] }>();
  private readonly groupRequests = new Map<string, Promise<WhatsAppGroup[]>>();
  constructor(private readonly dependencies = defaultDependencies) {}

  async connect(userId: string) {
    userIdSchema.parse(userId);
    if (this.stopping) throw new HttpError(503, 'O servidor está reiniciando. Tente novamente em instantes.');
    const pending = this.connecting.get(userId);
    if (pending) return pending;
    const current = this.sessions.get(userId);
    if (current?.connected) return { status: 'connected' as const };
    if (current?.socket) return { status: 'connecting' as const, qr: current.qr };

    const request = this.initialize(userId);
    this.connecting.set(userId, request);
    try { return await request; } finally { this.connecting.delete(userId); }
  }

  private async initialize(userId: string) {
    let resolveReady!: (ready: boolean) => void;
    const ready = new Promise<boolean>((resolve) => { resolveReady = resolve; });
    const session: Session = { connected: false, registered: false, ready, resolveReady };
    this.sessions.set(userId, session);
    try {
    const { socket, saveCreds, registered } = await this.dependencies.createSocket(userId);
    if (this.stopping) { socket.end(undefined); throw new HttpError(503, 'O servidor está reiniciando.'); }
    session.socket = socket;
    session.registered = registered;
    for (const event of ['groups.update', 'groups.upsert', 'group-participants.update'] as const) {
      socket.ev.on(event, () => this.groupCache.delete(userId));
    }

    socket.ev.on('creds.update', () => { void saveCreds().catch(() => console.error('Falha ao salvar credenciais do WhatsApp')); });
    socket.ev.on('connection.update', (update) => { void (async () => {
      const { connection, lastDisconnect, qr } = update;
      if (this.sessions.get(userId) !== session) return;
      if (qr) {
        const image = await QRCode.toDataURL(qr);
        if (this.sessions.get(userId) !== session || session.connected) return;
        session.qr = image; session.resolveReady(true);
      }
      if (connection === 'open') {
        session.connected = true;
        session.qr = undefined;
        session.pairing = undefined;
        session.registered = true;
        session.resolveReady(true);
      }
      if (connection === 'close') {
        session.socket = undefined;
        session.connected = false;
        session.pairing = undefined;
        session.resolveReady(false);
        const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        this.sessions.delete(userId);
        this.groupCache.delete(userId);
        this.groupRequests.delete(userId);
        if (!this.stopping && code !== DisconnectReason.loggedOut && (session.registered || code === DisconnectReason.restartRequired)) {
          const timer = setTimeout(() => {
            if (!this.sessions.has(userId)) void this.connect(userId).catch(() => console.error('Falha ao reconectar WhatsApp'));
          }, 2000);
          timer.unref();
        }
      }
    })().catch(() => console.error('Falha ao processar estado do WhatsApp')); });
    return { status: 'connecting' as const };
    } catch (error) {
      session.resolveReady(false);
      if (this.sessions.get(userId) === session) this.sessions.delete(userId);
      throw error;
    }
  }

  async requestPairingCode(userId: string, phoneNumber: string) {
    userIdSchema.parse(userId);
    const input = pairingSchema.parse({ phoneNumber });
    await withPairingTimeout(this.connect(userId));
    const session = this.sessions.get(userId);
    if (!session?.socket) throw new HttpError(409, 'A sessão não está disponível. Inicie a conexão novamente.');
    if (session.connected) return { status: 'connected' };
    if (session.registered) return { status: 'connecting' };
    if (session.pairingRequest) {
      if (session.pairingPhone !== input.phoneNumber) throw new HttpError(409, 'Já existe uma solicitação para outro número. Aguarde a conclusão.');
      return session.pairingRequest;
    }
    if (session.pairing && session.pairing.refreshAt > Date.now()) {
      if (session.pairing.phoneNumber !== input.phoneNumber) throw new HttpError(409, 'Aguarde um minuto antes de solicitar para outro número.');
      return { status: 'pairing', code: session.pairing.code, refreshAfterSeconds: Math.ceil((session.pairing.refreshAt - Date.now()) / 1000) };
    }
    session.pairingPhone = input.phoneNumber;
    const request = (async () => {
      if (!(await withPairingTimeout(session.ready))) throw new HttpError(409, 'Conexão encerrada. Solicite um novo código.');
      if (session.connected || session.registered) return { status: session.connected ? 'connected' : 'connecting' };
      if (this.sessions.get(userId) !== session || !session.socket) throw new HttpError(409, 'Conexão alterada. Solicite novamente.');
      const code = await withPairingTimeout(session.socket.requestPairingCode(input.phoneNumber));
      if (this.sessions.get(userId) !== session || !session.socket) throw new HttpError(409, 'Conexão encerrada. Solicite um novo código.');
      if (session.connected) return { status: 'connected' };
      session.pairing = { phoneNumber: input.phoneNumber, code, refreshAt: Date.now() + 60000 };
      return { status: 'pairing', code, refreshAfterSeconds: 60 };
    })();
    session.pairingRequest = request;
    try { return await request; } finally { session.pairingRequest = undefined; session.pairingPhone = undefined; }
  }

  getQr(userId: string) {
    return this.sessions.get(userId)?.qr ?? null;
  }

  async restore(allowedUserIds: Set<string>) {
    let entries;
    try { entries = await readdir(config.authDir, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (!entry.isDirectory() || !userIdSchema.safeParse(entry.name).success || !allowedUserIds.has(entry.name)) continue;
      try {
        const creds = JSON.parse(await readFile(path.join(config.authDir, entry.name, 'creds.json'), 'utf8'));
        if (creds.registered === true) await this.connect(entry.name);
      } catch { console.error('Falha ao restaurar uma sessão WhatsApp'); }
    }
  }

  close() {
    this.stopping = true;
    for (const session of this.sessions.values()) {
      session.resolveReady(false);
      session.socket?.end(undefined);
    }
    this.sessions.clear();
    this.groupCache.clear();
    this.groupRequests.clear();
  }

  getStatus(userId: string) {
    const session = this.sessions.get(userId);
    return { connected: session?.connected ?? false, status: session?.connected ? 'connected' : session?.socket ? 'connecting' : 'disconnected' };
  }

  async listGroups(userId: string, force = false): Promise<WhatsAppGroup[]> {
    const socket = this.requireSocket(userId);
    const cached = this.groupCache.get(userId);
    if (!force && cached && cached.expires > Date.now()) return cached.groups;
    const pending = this.groupRequests.get(userId);
    if (pending) return pending;
    const request = (async () => {
      const groups = await socket.groupFetchAllParticipating();
      const list = Object.values(groups).map((group) => ({ id: group.id, subject: group.subject }));
      if (this.sessions.get(userId)?.socket === socket) this.groupCache.set(userId, { expires: Date.now() + 60000, groups: list });
      return list;
    })();
    this.groupRequests.set(userId, request);
    try { return await request; } finally { if (this.groupRequests.get(userId) === request) this.groupRequests.delete(userId); }
  }

  async sendMessage(userId: string, groupJid: string, text: string, media?: { url: string; type?: string }, authorize?: () => Promise<unknown>) {
    const socket = this.requireSocket(userId);
    if (authorize) await authorize();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const content = media?.url ? media.type?.startsWith('video') ? { video: { url: media.url }, caption: text } : { image: { url: media.url }, caption: text } : { text };
      return await Promise.race([
        socket.sendMessage(groupJid, content),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new UncertainDeliveryError()), this.dependencies.sendTimeoutMs ?? config.sendTimeoutMs); })
      ]);
    } catch {
      throw new UncertainDeliveryError();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private requireSocket(userId: string) {
    const socket = this.sessions.get(userId)?.socket;
    if (!socket || !this.sessions.get(userId)?.connected) throw new Error('Sessão do WhatsApp não está conectada');
    return socket;
  }
}

export const whatsappService = new WhatsAppService();
export const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
