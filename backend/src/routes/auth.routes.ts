import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { securityConfig } from '../config/security.js';
import { createRateLimit, resetRateLimit } from '../middlewares/rate-limit.middleware.js';

const router = Router();

const loginRateLimitKey = (req: any) =>
  `${req.ip}:${String(req.body?.username || '').trim().toLowerCase()}`;

const passwordChangeRateLimitKey = (req: AuthRequest) =>
  `${req.ip}:${req.user?.id ?? 'anonymous'}`;

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

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const { user, token } = await AuthService.login(username, password);
    resetRateLimit(loginRateLimitKey(req));
    res.json({ user, token });
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

export default router;
