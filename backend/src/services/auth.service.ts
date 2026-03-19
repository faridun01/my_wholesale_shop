import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../db/prisma.js';
import { securityConfig } from '../config/security.js';

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
})();

type PublicUser = {
  id: number;
  username: string;
  phone: string | null;
  role: string;
  warehouseId: number | null;
  active: boolean;
  canCancelInvoices: boolean;
  canDeleteData: boolean;
  createdAt: Date;
  updatedAt: Date;
  warehouse: { id: number; name: string; city: string | null } | null;
};

const toPublicUser = (user: any): PublicUser => ({
  id: user.id,
  username: user.username,
  phone: user.phone ?? null,
  role: user.role,
  warehouseId: user.warehouseId ?? null,
  active: user.active,
  canCancelInvoices: Boolean(user.canCancelInvoices),
  canDeleteData: Boolean(user.canDeleteData),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  warehouse: user.warehouse
    ? { id: user.warehouse.id, name: user.warehouse.name, city: user.warehouse.city ?? null }
    : null,
});

const INVALID_CREDENTIALS_ERROR = 'Invalid credentials';

const createHttpError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

const normalizeUsername = (username: string) => username.trim();

const validatePasswordStrength = (password: string) => {
  if (password.length < securityConfig.auth.minimumPasswordLength) {
    throw createHttpError(`Password must be at least ${securityConfig.auth.minimumPasswordLength} characters long`, 400);
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw createHttpError('Password must contain uppercase, lowercase letters and at least one number', 400);
  }
};

const ensureUniqueUsername = async (username: string, excludeUserId?: number) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      id: excludeUserId ? { not: excludeUserId } : undefined,
      username: {
        equals: username,
        mode: 'insensitive',
      },
    },
  });

  if (existingUser) {
    throw createHttpError('A user with this username already exists', 409);
  }
};

export class AuthService {
  /**
   * Authenticates a user and returns a token.
   */
  static async login(username: string, password: string) {
    const normalizedUsername = normalizeUsername(username);
    const user = await prisma.user.findFirst({
      where: { username: normalizedUsername, active: true },
      include: { warehouse: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw createHttpError(INVALID_CREDENTIALS_ERROR, 401);
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        warehouseId: user.warehouseId,
        canCancelInvoices: user.canCancelInvoices,
        canDeleteData: user.canDeleteData,
      },
      JWT_SECRET,
      {
        expiresIn: securityConfig.auth.tokenExpiresIn as SignOptions['expiresIn'],
        issuer: securityConfig.auth.tokenIssuer,
        audience: securityConfig.auth.tokenAudience,
      }
    );

    return { user: toPublicUser(user), token };
  }

  /**
   * Creates a new user with a hashed password.
   */
  static async register(data: { username: string; password: string; phone?: string; role?: string; warehouseId?: number; canCancelInvoices?: boolean; canDeleteData?: boolean }) {
    const username = normalizeUsername(data.username);
    validatePasswordStrength(data.password);
    await ensureUniqueUsername(username);
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPassword,
        phone: data.phone,
        role: data.role || 'SELLER',
        warehouseId: data.warehouseId,
        canCancelInvoices: data.canCancelInvoices || false,
        canDeleteData: data.canDeleteData || false,
      },
      include: { warehouse: true },
    });

    return toPublicUser(user);
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      throw createHttpError(INVALID_CREDENTIALS_ERROR, 401);
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw createHttpError(INVALID_CREDENTIALS_ERROR, 401);
    }

    validatePasswordStrength(newPassword);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword }
    });
  }

  static async updateUser(id: number, data: any) {
    const updateData: any = { ...data };
    if (typeof data.username === 'string') {
      updateData.username = normalizeUsername(data.username);
      await ensureUniqueUsername(updateData.username, id);
    }
    if (data.password) {
      validatePasswordStrength(data.password);
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { warehouse: true },
    });

    return toPublicUser(user);
  }

  static async getAllUsers() {
    const users = await prisma.user.findMany({
      where: { active: true },
      include: { warehouse: true },
    });

    return users.map(toPublicUser);
  }

  static async deleteUser(id: number) {
    return await prisma.user.update({
      where: { id },
      data: { active: false }
    });
  }
}
