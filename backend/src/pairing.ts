import { z } from 'zod';
import { HttpError } from './errors.js';

export const pairingSchema = z.object({
  phoneNumber: z.string().trim().transform((value) => value.replace(/[\s()+-]/g, ''))
    .pipe(z.string().regex(/^[1-9][0-9]{7,14}$/, 'Informe o número com país e DDD, sem letras. Ex.: +55 11 99999-9999'))
});

export async function withPairingTimeout<T>(promise: Promise<T>, timeoutMs = 30000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new HttpError(504, 'A conexão demorou para responder. Atualize o estado e tente novamente.')), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
