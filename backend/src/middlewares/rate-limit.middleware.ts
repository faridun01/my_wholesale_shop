import { NextFunction, Request, Response } from 'express';
import prisma from '../db/prisma.js';

type RateLimitOptions = {
  windowMs: number;
  maxAttempts: number;
  blockMs: number;
  message: string;
  keyGenerator?: (req: Request) => string;
};

type RateLimitRow = {
  key: string;
  count: number;
  reset_at: Date;
  blocked_until: Date | null;
};

let storageInitPromise: Promise<void> | null = null;

const getIp = (req: Request) =>
  req.ip || req.socket.remoteAddress || 'unknown';

export const initRateLimitStorage = async () => {
  if (!storageInitPromise) {
    storageInitPromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS rate_limit_entries (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at TIMESTAMPTZ NOT NULL,
        blocked_until TIMESTAMPTZ NULL
      )
    `).then(() => undefined);
  }

  await storageInitPromise;
};

const getRateLimitRow = async (tx: any, key: string) => {
  const rows = (await tx.$queryRawUnsafe(
    'SELECT key, count, reset_at, blocked_until FROM rate_limit_entries WHERE key = $1 FOR UPDATE',
    key
  )) as RateLimitRow[];

  return rows[0] || null;
};

const deleteRateLimitRow = async (tx: any, key: string) => {
  await tx.$executeRawUnsafe('DELETE FROM rate_limit_entries WHERE key = $1', key);
};

const upsertRateLimitRow = async (
  tx: any,
  key: string,
  count: number,
  resetAt: Date,
  blockedUntil: Date | null
) => {
  await tx.$executeRawUnsafe(
    `
      INSERT INTO rate_limit_entries (key, count, reset_at, blocked_until)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (key)
      DO UPDATE SET
        count = EXCLUDED.count,
        reset_at = EXCLUDED.reset_at,
        blocked_until = EXCLUDED.blocked_until
    `,
    key,
    count,
    resetAt,
    blockedUntil
  );
};

export const createRateLimit = ({
  windowMs,
  maxAttempts,
  blockMs,
  message,
  keyGenerator,
}: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const now = new Date();
    const key = keyGenerator?.(req) || getIp(req);

    try {
      await initRateLimitStorage();

      const result = await prisma.$transaction(async (tx) => {
        const record = await getRateLimitRow(tx, key);

        if (record?.blocked_until && record.blocked_until.getTime() > now.getTime()) {
          return {
            blocked: true,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((record.blocked_until.getTime() - now.getTime()) / 1000)
            ),
          };
        }

        if (record && record.reset_at.getTime() <= now.getTime()) {
          await deleteRateLimitRow(tx, key);
        }

        const shouldReuseWindow =
          record &&
          record.reset_at.getTime() > now.getTime() &&
          (!record.blocked_until || record.blocked_until.getTime() <= now.getTime());

        const currentCount = shouldReuseWindow ? Number(record.count || 0) : 0;
        const resetAt = shouldReuseWindow
          ? record!.reset_at
          : new Date(now.getTime() + windowMs);

        const nextCount = currentCount + 1;
        const blockedUntil =
          nextCount > maxAttempts
            ? new Date(now.getTime() + blockMs)
            : null;

        await upsertRateLimitRow(tx, key, nextCount, resetAt, blockedUntil);

        if (blockedUntil) {
          return {
            blocked: true,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)
            ),
          };
        }

        return { blocked: false as const };
      });

      if (result.blocked) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        return res.status(429).json({ error: message });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const resetRateLimit = async (key: string) => {
  try {
    await initRateLimitStorage();
    await prisma.$executeRawUnsafe('DELETE FROM rate_limit_entries WHERE key = $1', key);
  } catch {
    // Best-effort cleanup only.
  }
};
