import 'dotenv/config';
import { z } from 'zod';

const integer = (fallback: number, min = 0) => z.preprocess(
  (value) => value === undefined ? fallback : value,
  z.coerce.number().int().min(min)
);

export const environmentSchema = z.object({
  PORT: integer(3333, 1).refine((value) => value <= 65535, 'Porta inválida'),
  HOST: z.string().min(1).default('127.0.0.1'),
  ADMIN_API_TOKEN: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  PUBLIC_URL: z.string().url().optional(),
  PAYMENT_WHATSAPP: z.string().regex(/^[1-9][0-9]{9,14}$/).optional(),
  PIX_KEY: z.string().optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379').refine((url) => ['redis:', 'rediss:'].includes(new URL(url).protocol)),
  WHATSAPP_AUTH_DIR: z.string().min(1).default('./.sessions'),
  MIN_MESSAGE_DELAY_MS: integer(10000, 10000),
  MAX_MESSAGE_DELAY_MS: integer(10000, 10000),
  GROUP_BATCH_SIZE: integer(30, 1),
  MIN_BATCH_PAUSE_MS: integer(60000, 60000),
  MAX_BATCH_PAUSE_MS: integer(60000, 60000),
  // Retained for compatibility; dispatch no longer simulates typing.
  COMPOSING_MIN_MS: integer(0),
  COMPOSING_MAX_MS: integer(0),
  SEND_TIMEOUT_MS: integer(45000, 10000),
  DISPATCH_CONCURRENCY: integer(3, 1).refine(value => value <= 10, 'Use no máximo 10 transmissões simultâneas'),
  DISPATCH_MEMORY_SOFT_MB: integer(1280, 128),
  MAX_ACTIVE_CAMPAIGNS: integer(2, 1).refine((value) => value <= 5, 'Use no máximo 5 campanhas ativas por cliente')
}).superRefine((env, ctx) => {
  for (const [min, max] of [
    ['MIN_MESSAGE_DELAY_MS', 'MAX_MESSAGE_DELAY_MS'],
    ['MIN_BATCH_PAUSE_MS', 'MAX_BATCH_PAUSE_MS'],
    ['COMPOSING_MIN_MS', 'COMPOSING_MAX_MS']
  ] as const) {
    if (env[min] > env[max]) ctx.addIssue({ code: 'custom', path: [max], message: `${max} deve ser maior ou igual a ${min}` });
  }
});

const env = environmentSchema.parse(process.env);
export const config = {
  port: env.PORT,
  host: env.HOST,
  adminApiToken: env.ADMIN_API_TOKEN,
  publicUrl: env.PUBLIC_URL,
  paymentWhatsapp: env.PAYMENT_WHATSAPP,
  pixKey: env.PIX_KEY,
  redisUrl: env.REDIS_URL,
  authDir: env.WHATSAPP_AUTH_DIR,
  minMessageDelayMs: env.MIN_MESSAGE_DELAY_MS,
  maxMessageDelayMs: env.MAX_MESSAGE_DELAY_MS,
  groupBatchSize: env.GROUP_BATCH_SIZE,
  minBatchPauseMs: env.MIN_BATCH_PAUSE_MS,
  maxBatchPauseMs: env.MAX_BATCH_PAUSE_MS,
  composingMinMs: env.COMPOSING_MIN_MS,
  composingMaxMs: env.COMPOSING_MAX_MS,
  sendTimeoutMs: env.SEND_TIMEOUT_MS,
  dispatchConcurrency: env.DISPATCH_CONCURRENCY,
  dispatchMemorySoftMb: env.DISPATCH_MEMORY_SOFT_MB,
  maxActiveCampaigns: env.MAX_ACTIVE_CAMPAIGNS
};
