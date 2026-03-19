const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const parseOrigins = (value?: string | null) =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const allowedOrigins = Array.from(
  new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...parseOrigins(process.env.CORS_ORIGINS),
    ...parseOrigins(process.env.FRONTEND_ORIGIN),
  ])
);

export const securityConfig = {
  cors: {
    origins: allowedOrigins,
  },
  auth: {
    tokenIssuer: process.env.JWT_ISSUER || 'my-wholesale-shop',
    tokenAudience: process.env.JWT_AUDIENCE || 'my-wholesale-shop-users',
    tokenExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    minimumPasswordLength: 8,
  },
  rateLimit: {
    loginWindowMs: 15 * 60 * 1000,
    loginMaxAttempts: 8,
    loginBlockMs: 30 * 60 * 1000,
    passwordChangeWindowMs: 15 * 60 * 1000,
    passwordChangeMaxAttempts: 5,
    passwordChangeBlockMs: 30 * 60 * 1000,
    uploadWindowMs: 5 * 60 * 1000,
    uploadMaxAttempts: 30,
    uploadBlockMs: 10 * 60 * 1000,
  },
  upload: {
    maxImageBytes: 5 * 1024 * 1024,
    maxDocumentBytes: 10 * 1024 * 1024,
  },
} as const;
