import { NextFunction, Request, Response } from 'express';
import type { AuthRequest } from './auth.middleware.js';

type Bucket = { count: number; resetAt: number };

// In-memory (not DB-backed like rate-limit.middleware.ts) so it adds no extra DB
// round-trip to every authenticated request. Defense-in-depth throttling for
// authenticated traffic; login/2FA/password-change keep their dedicated,
// persistent, brute-force-focused limiter in rate-limit.middleware.ts.
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 300;

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}, WINDOW_MS).unref();

export const generalRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const key = authReq.user ? `user:${authReq.user.id}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({ error: 'Too many requests, please slow down' });
  }

  next();
};
