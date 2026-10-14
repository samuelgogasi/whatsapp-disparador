import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const hashSecret = (value: string) => createHash('sha256').update(value).digest('hex');
export const createSecret = (prefix: string) => `${prefix}_${randomBytes(32).toString('base64url')}`;
export const secretsEqual = (actual: string, expected: string) => timingSafeEqual(
  createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest()
);

const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, (error, result) => error ? reject(error) : resolve(result));
});

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, digest] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = await derive(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
