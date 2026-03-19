import { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
  windowMs: number;
  maxAttempts: number;
  blockMs: number;
  message: string;
  keyGenerator?: (req: Request) => string;
};

type AttemptRecord = {
  count: number;
  resetAt: number;
  blockedUntil: number;
};

const attempts = new Map<string, AttemptRecord>();

const getIp = (req: Request) =>
  req.ip || req.socket.remoteAddress || 'unknown';

const cleanupIfExpired = (key: string, now: number) => {
  const existing = attempts.get(key);
  if (!existing) return null;

  if (existing.blockedUntil > now) {
    return existing;
  }

  if (existing.resetAt <= now) {
    attempts.delete(key);
    return null;
  }

  return existing;
};

export const createRateLimit = ({
  windowMs,
  maxAttempts,
  blockMs,
  message,
  keyGenerator,
}: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyGenerator?.(req) || getIp(req);
    const record = cleanupIfExpired(key, now);

    if (record && record.blockedUntil > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.blockedUntil - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    const current = record && record.resetAt > now
      ? record
      : { count: 0, resetAt: now + windowMs, blockedUntil: 0 };

    current.count += 1;
    if (current.count > maxAttempts) {
      current.blockedUntil = now + blockMs;
      attempts.set(key, current);
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(blockMs / 1000))));
      return res.status(429).json({ error: message });
    }

    attempts.set(key, current);
    next();
  };
};

export const resetRateLimit = (key: string) => {
  attempts.delete(key);
};
