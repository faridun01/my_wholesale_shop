import { Router } from 'express';
import { AuthRequest, authorize } from '../middlewares/auth.middleware.js';
import { getAccessContext } from '../utils/access.js';
import { CashService, assertCanAcceptPayments } from '../services/cash.service.js';

const router = Router();
const adminOnly = authorize(['ADMIN']);

// --- The signed-in person's own cash: never anyone else's. ---

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    res.json(await CashService.myCash(req.user!.id));
  } catch (error) { next(error); }
});

router.post('/handovers', async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await CashService.createHandover(req.user!.id, req.body));
  } catch (error) { next(error); }
});

router.get('/debtors', async (req: AuthRequest, res, next) => {
  try {
    assertCanAcceptPayments(req.user);
    res.json(await CashService.debtors(await getAccessContext(req), req.query.search));
  } catch (error) { next(error); }
});

// --- Administrator. ---

router.get('/pending-count', adminOnly, async (_req: AuthRequest, res, next) => {
  try {
    res.json({ count: await CashService.pendingCount() });
  } catch (error) { next(error); }
});

router.get('/handovers', adminOnly, async (req: AuthRequest, res, next) => {
  try {
    res.json(await CashService.listHandovers(req.query.status ? String(req.query.status) : undefined));
  } catch (error) { next(error); }
});

router.post('/handovers/:id/confirm', adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    res.json(await CashService.confirmHandover(id, req.user!.id));
  } catch (error) { next(error); }
});

router.get('/staff', adminOnly, async (_req: AuthRequest, res, next) => {
  try {
    res.json(await CashService.staffBalances());
  } catch (error) { next(error); }
});

export default router;
