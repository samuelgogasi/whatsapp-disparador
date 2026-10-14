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
  MIN_MESSAGE_DELAY_MS: integer(8000),
  MAX_MESSAGE_DELAY_MS: integer(25000),
  GROUP_BATCH_SIZE: integer(30, 1),
  MIN_BATCH_PAUSE_MS: integer(300000),
  MAX_BATCH_PAUSE_MS: integer(600000),
  COMPOSING_MIN_MS: integer(2000),
  COMPOSING_MAX_MS: integer(5000)
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
  composingMaxMs: env.COMPOSING_MAX_MS
};
