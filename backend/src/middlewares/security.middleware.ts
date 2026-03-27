import cors, { CorsOptions } from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { securityConfig } from '../config/security.js';

const buildCorsOriginCheck = (): CorsOptions['origin'] => {
  const { origins } = securityConfig.cors;

  return (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (origins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  };
};

export const corsMiddleware = cors({
  origin: buildCorsOriginCheck(),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
  maxAge: 86400,
});

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
};
