import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import prisma from '../db/prisma.js';
import { securityConfig } from '../config/security.js';

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
})();

type AuthDbUser = {
  id: number;
  username: string;
  role: string;
  warehouseId: number | null;
  customerId: number | null;
  canCancelInvoices: boolean;
  canDeleteData: boolean;
};

const USER_CACHE_TTL_MS = 60_000;
const userCache = new Map<number, {
  user: AuthDbUser;
  expiresAt: number;
}>();

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    warehouseId?: number;
    customerId?: number;
    canCancelInvoices?: boolean;
    canDeleteData?: boolean;
  };
}

const buildAuthUser = (user: AuthDbUser) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  warehouseId: user.warehouseId ?? undefined,
  customerId: user.customerId ?? undefined,
  canCancelInvoices: user.canCancelInvoices,
  canDeleteData: user.canDeleteData,
});

export const invalidateUserCache = (userId?: number) => {
  if (typeof userId === 'number' && Number.isFinite(userId)) {
    userCache.delete(userId);
    return;
  }

  userCache.clear();
};

const parseCookies = (cookieHeader?: string) => {
  const safeDecode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const entries = String(cookieHeader || '')
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const separatorIndex = chunk.indexOf('=');
      if (separatorIndex === -1) {
        return [chunk, ''] as const;
      }

      return [
        safeDecode(chunk.slice(0, separatorIndex).trim()),
        safeDecode(chunk.slice(separatorIndex + 1).trim()),
      ] as const;
    });

  return Object.fromEntries(entries);
};

const getBearerToken = (authHeader?: string) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.split(' ')[1];
};

const getRequestToken = (req: Request) => {
  const bearerToken = getBearerToken(req.headers.authorization);
  if (bearerToken) {
    return bearerToken;
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies.auth_token || null;
};

const resolveUserFromToken = async (token: string) => {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: securityConfig.auth.tokenIssuer,
    audience: securityConfig.auth.tokenAudience,
  }) as any;
  const userId = Number(decoded?.id);

  if (!Number.isFinite(userId)) {
    throw new Error('Invalid token');
  }

  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return buildAuthUser(cached.user);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      warehouseId: true,
      customerId: true,
      active: true,
      canCancelInvoices: true,
      canDeleteData: true,
    },
  });

  if (!user || !user.active) {
    userCache.delete(userId);
    throw new Error('Unauthorized');
  }

  userCache.set(userId, {
    user,
    expiresAt: Date.now() + USER_CACHE_TTL_MS,
  });

  return buildAuthUser(user);
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = getRequestToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = await resolveUserFromToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authenticateUploadAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const allowUploadQueryToken = String(process.env.ALLOW_UPLOAD_QUERY_TOKEN || 'false').toLowerCase() === 'true';
  const queryToken =
    allowUploadQueryToken && typeof req.query.token === 'string'
      ? req.query.token
      : null;
  const token = getRequestToken(req) || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = await resolveUserFromToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.some(role => role.toUpperCase() === req.user?.role.toUpperCase())) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
