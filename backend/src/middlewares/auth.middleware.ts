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

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    warehouseId?: number;
    canCancelInvoices?: boolean;
    canDeleteData?: boolean;
  };
}

const buildAuthUser = (user: {
  id: number;
  username: string;
  role: string;
  warehouseId: number | null;
  canCancelInvoices: boolean;
  canDeleteData: boolean;
}) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  warehouseId: user.warehouseId ?? undefined,
  canCancelInvoices: user.canCancelInvoices,
  canDeleteData: user.canDeleteData,
});

const getBearerToken = (authHeader?: string) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.split(' ')[1];
};

const resolveUserFromToken = async (token: string) => {
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: securityConfig.auth.tokenIssuer,
    audience: securityConfig.auth.tokenAudience,
  }) as any;
  const userId = Number(decoded?.id);

  if (!Number.isFinite(userId)) {
    throw new Error('Invalid token');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      warehouseId: true,
      active: true,
      canCancelInvoices: true,
      canDeleteData: true,
    },
  });

  if (!user || !user.active) {
    throw new Error('Unauthorized');
  }

  return buildAuthUser(user);
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = getBearerToken(req.headers.authorization);
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
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const token = getBearerToken(req.headers.authorization) || queryToken;

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
