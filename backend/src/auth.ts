import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { createSecret, hashSecret, secretsEqual } from './security.js';
import { HttpError } from './errors.js';

export const sessionCookie = 'wpp_session';
export const sessionDurationMs = 12 * 60 * 60 * 1000;

export async function createLoginSession(db: PrismaClient, userId: string, res: Response, secure: boolean) {
  const token = createSecret('session');
  await db.authSession.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
  await db.authSession.create({ data: { userId, tokenHash: hashSecret(token), expiresAt: new Date(Date.now() + sessionDurationMs) } });
  res.cookie(sessionCookie, token, { httpOnly: true, secure, sameSite: 'strict', maxAge: sessionDurationMs, path: '/' });
}

export function readSessionToken(req: Request) {
  const bearer = req.get('authorization');
  if (bearer?.startsWith('Bearer session_')) return bearer.slice(7);
  const cookie = req.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`));
  return cookie?.slice(sessionCookie.length + 1);
}

export function authenticate(db: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = readSessionToken(req);
      if (!token || token.length > 200) throw new HttpError(401, 'Entre na sua conta para continuar.');
      const session = await db.authSession.findUnique({ where: { tokenHash: hashSecret(token) } });
      if (!session || session.expiresAt <= new Date()) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
      res.locals.userId = session.userId;
      next();
    } catch (error) { next(error); }
  };
}

export function authenticateAdmin(expected: string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!expected) return next(new HttpError(503, 'Administração não configurada no servidor.'));
    const token = req.get('x-admin-token') ?? req.get('authorization')?.replace(/^Bearer /, '') ?? '';
    if (!secretsEqual(token, expected)) return next(new HttpError(401, 'Credencial administrativa inválida.'));
    return next();
  };
}

// Limitador local adequado à primeira implantação com uma instância.
export function authRateLimit(max = 30, windowMs = 15 * 60 * 1000) {
  const buckets = new Map<string, { count: number; end: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.end <= now) buckets.delete(key);
    const key = req.ip ?? 'unknown';
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 10000) return next(new HttpError(429, 'Muitas tentativas. Aguarde para tentar novamente.'));
      bucket = { count: 0, end: now + windowMs };
      buckets.set(key, bucket);
    }
    if (++bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.end - now) / 1000)));
      return next(new HttpError(429, 'Muitas tentativas. Aguarde para tentar novamente.'));
    }
    next();
  };
}
