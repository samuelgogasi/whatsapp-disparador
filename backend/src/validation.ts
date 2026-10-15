import { z } from 'zod';

export const userIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, 'userId deve conter apenas letras, números, _ ou - (até 64 caracteres)');

export const campaignSchema = z.object({
  userId: userIdSchema,
  text: z.string().trim().min(1).max(10000),
  confirmed: z.literal(true, { error: 'Confirme que revisou a mensagem e que os grupos autorizaram esta divulgação.' }),
  groupJids: z.array(z.string().regex(/^[0-9]+(?:-[0-9]+)?@g\.us$/, 'JID de grupo inválido')).min(1).max(1000),
  mediaUrl: z.string().url().refine((url) => ['https:', 'http:'].includes(new URL(url).protocol), 'Use uma URL HTTP(S)').optional(),
  mediaType: z.enum(['image', 'video']).optional(),
  scheduledAt: z.string().datetime({ offset: true })
    .transform((value) => new Date(value))
    .refine((value) => value.getTime() >= Date.now() + 60_000, 'Agende com pelo menos 1 minuto de antecedência')
    .refine((value) => value.getTime() <= Date.now() + 366 * 24 * 60 * 60 * 1000, 'Agende no máximo 1 ano à frente')
    .optional()
}).superRefine((input, ctx) => {
  if (new Set(input.groupJids).size !== input.groupJids.length) {
    ctx.addIssue({ code: 'custom', path: ['groupJids'], message: 'Há grupos duplicados' });
  }
  if (Boolean(input.mediaUrl) !== Boolean(input.mediaType)) {
    ctx.addIssue({ code: 'custom', path: ['mediaType'], message: 'Informe mediaUrl e mediaType juntos' });
  }
});
