import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { securityConfig } from '../config/security.js';
import { createRateLimit, resetRateLimit } from '../middlewares/rate-limit.middleware.js';
import prisma from '../db/prisma.js';

const router = Router();

const loginRateLimitKey = (req: any) =>
  `${req.ip}:${String(req.body?.username || '').trim().toLowerCase()}`;

const passwordChangeRateLimitKey = (req: AuthRequest) =>
  `${req.ip}:${req.user?.id ?? 'anonymous'}`;

const twoFactorRateLimitKey = (req: any) =>
  `${req.ip}:${String(req.body?.twoFactorToken || req.body?.setupToken || req.user?.id || 'anonymous')}`;

const loginRateLimit = createRateLimit({
  windowMs: securityConfig.rateLimit.loginWindowMs,
  maxAttempts: securityConfig.rateLimit.loginMaxAttempts,
  blockMs: securityConfig.rateLimit.loginBlockMs,
  message: 'Too many login attempts. Please try again later.',
  keyGenerator: loginRateLimitKey,
});

const passwordChangeRateLimit = createRateLimit({
  windowMs: securityConfig.rateLimit.passwordChangeWindowMs,
  maxAttempts: securityConfig.rateLimit.passwordChangeMaxAttempts,
  blockMs: securityConfig.rateLimit.passwordChangeBlockMs,
  message: 'Too many password change attempts. Please try again later.',
  keyGenerator: (req) => passwordChangeRateLimitKey(req as AuthRequest),
});

const twoFactorRateLimit = createRateLimit({
  windowMs: securityConfig.rateLimit.twoFactorWindowMs,
  maxAttempts: securityConfig.rateLimit.twoFactorMaxAttempts,
  blockMs: securityConfig.rateLimit.twoFactorBlockMs,
  message: 'Too many two-factor attempts. Please try again later.',
  keyGenerator: twoFactorRateLimitKey,
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await AuthService.login(username, password);
    if (result.requiresTwoFactor) {
      return res.json(result);
    }

    resetRateLimit(loginRateLimitKey(req));
    res.json({ user: result.user, token: result.token, requiresTwoFactor: false });
  } catch (error) {
    next(error);
  }
});

router.get('/users', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const users = await AuthService.getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await AuthService.getCurrentUser(req.user!.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/register', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const user = await AuthService.register(req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/public-register', async (req, res, next) => {
  try {
    return res.status(403).json({ error: 'Публичная регистрация отключена' });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id', authenticate, async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    const currentUser = (req as any).user;
    const isAdmin = currentUser.role.toUpperCase() === 'ADMIN';

    // Only ADMIN can update others, users can update themselves
    if (!isAdmin && currentUser.id !== targetId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Non-admins cannot change their own role or warehouse
    const updateData = { ...req.body };
    if (!isAdmin) {
      delete updateData.role;
      delete updateData.warehouseId;
      delete updateData.canCancelInvoices;
      delete updateData.canDeleteData;
    }

    const user = await AuthService.updateUser(targetId, updateData);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    await AuthService.deleteUser(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', authenticate, passwordChangeRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
    resetRateLimit(passwordChangeRateLimitKey(req));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/2fa/login', twoFactorRateLimit, async (req, res, next) => {
  try {
    const { twoFactorToken, code } = req.body;
    if (!twoFactorToken || !code) {
      return res.status(400).json({ error: 'twoFactorToken and code are required' });
    }

    const result = await AuthService.completeTwoFactorLogin(twoFactorToken, code);
    resetRateLimit(twoFactorRateLimitKey(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/2fa/setup', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await AuthService.createTwoFactorSetup(req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/2fa/verify-setup', authenticate, twoFactorRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const { setupToken, code } = req.body;
    if (!setupToken || !code) {
      return res.status(400).json({ error: 'setupToken and code are required' });
    }

    const result = await AuthService.verifyTwoFactorSetup(req.user!.id, setupToken, code);
    resetRateLimit(twoFactorRateLimitKey(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/2fa/disable', authenticate, twoFactorRateLimit, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, code } = req.body;
    if (!currentPassword || !code) {
      return res.status(400).json({ error: 'currentPassword and code are required' });
    }

    const result = await AuthService.disableTwoFactor(req.user!.id, currentPassword, code);
    resetRateLimit(twoFactorRateLimitKey(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/admin/reset-operational-data', authenticate, authorize(['ADMIN']), async (_req, res, next) => {
  try {
    const before = await Promise.all([
      prisma.customer.count(),
      prisma.product.count(),
      prisma.invoice.count(),
      prisma.payment.count(),
      prisma.return.count(),
    ]);

    await prisma.$transaction([
      prisma.saleAllocation.deleteMany(),
      prisma.invoiceItem.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.return.deleteMany(),
      prisma.invoice.deleteMany(),
      prisma.inventoryTransaction.deleteMany(),
      prisma.productBatch.deleteMany(),
      prisma.priceHistory.deleteMany(),
      prisma.product.deleteMany(),
      prisma.customer.deleteMany(),
    ]);

    const after = await Promise.all([
      prisma.customer.count(),
      prisma.product.count(),
      prisma.invoice.count(),
      prisma.payment.count(),
      prisma.return.count(),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      before: {
        customers: before[0],
        products: before[1],
        invoices: before[2],
        payments: before[3],
        returns: before[4],
      },
      after: {
        customers: after[0],
        products: after[1],
        invoices: after[2],
        payments: after[3],
        returns: after[4],
        users: after[5],
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
