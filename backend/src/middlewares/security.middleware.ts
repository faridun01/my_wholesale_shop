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

    return callback(Object.assign(new Error('Origin not allowed by CORS'), { status: 403 }));
  };
};

export const corsMiddleware = cors({
  origin: buildCorsOriginCheck(),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  exposedHeaders: ['X-Page', 'X-Limit', 'X-Total-Count', 'X-Total-Pages', 'X-Has-More'],
  credentials: true,
  maxAge: 86400,
});

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  const isProduction = process.env.NODE_ENV === 'production';
  // Express derives secure only through the configured trusted proxy chain.
  const isHttps = req.secure;
  const cspReportOnly = String(process.env.CSP_REPORT_ONLY || 'true').toLowerCase() !== 'false';
  const cspReportUri = String(process.env.CSP_REPORT_URI || '').trim();
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "frame-src 'self' blob:",
    "form-action 'self'",
  ];

  if (cspReportUri) {
    cspDirectives.push(`report-uri ${cspReportUri}`);
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  if (cspReportOnly) {
    res.setHeader('Content-Security-Policy-Report-Only', cspDirectives.join('; '));
  } else {
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  }

  if (isProduction && isHttps) {
    // Same value as frontend/nginx.conf; browsers already hold it, so it must not shrink.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

// SameSite is a second layer, not the only CSRF check. Native clients using a
// bearer token without browser provenance remain supported.
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const referer = req.get('referer');
  let source = origin;
  if (!source && referer) {
    try { source = new URL(referer).origin; } catch { return res.status(403).json({ error: 'Invalid request origin' }); }
  }
  if (source && !securityConfig.cors.origins.includes(source)) return res.status(403).json({ error: 'Untrusted request origin' });
  const usesCookie = /(?:^|;\s*)auth_token=/.test(req.headers.cookie || '');
  if (!source && usesCookie && !req.headers.authorization?.startsWith('Bearer ')) return res.status(403).json({ error: 'Request origin required' });
  next();
};
