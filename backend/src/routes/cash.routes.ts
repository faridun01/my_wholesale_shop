import { Router } from 'express';
import { AuthRequest, authorize } from '../middlewares/auth.middleware.js';
import { getAccessContext, isAdminRole } from '../utils/access.js';
import { addMoney } from '../utils/financial.js';
import { CashService, assertCanAcceptPayments } from '../services/cash.service.js';
import { publishCashEvent, subscribeCashEvents } from '../services/cash-events.js';

const router = Router();
const adminOnly = authorize(['ADMIN']);
const idParam = (value: unknown) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// --- Live notices for open pages (Server-Sent Events). ---

router.get('/events', (req: AuthRequest, res) => {
  const user = req.user!;
  const isAdmin = isAdminRole(user.role);
  // no-transform keeps compression from buffering the stream; X-Accel-Buffering does the same for nginx.
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');
  const unsubscribe = subscribeCashEvents((event) => {
    if (isAdmin || event.userId === user.id) res.write(`event: cash\ndata: ${JSON.stringify(event)}\n\n`);
  });
  // Keeps proxies from closing a quiet connection.
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  // The browser reconnects through the sign-in check, so a changed role or a blocked
  // account stops receiving what it may no longer see.
  const lifetime = setTimeout(() => res.end(), 10 * 60 * 1000);
  res.on('close', () => {
    clearInterval(ping);
    clearTimeout(lifetime);
    unsubscribe();
  });
});

// --- The signed-in person's own cash: never anyone else's. ---

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    res.json(await CashService.myCash(req.user!.id));
  } catch (error) { next(error); }
});

router.post('/handovers', async (req: AuthRequest, res, next) => {
  try {
    const handover = await CashService.createHandover(req.user!.id, req.body);
    publishCashEvent({ type: 'handover_sent', userId: req.user!.id, username: req.user!.username, handoverId: handover.id, amount: addMoney(handover.amount) });
    res.status(201).json(handover);
  } catch (error) { next(error); }
});

// The staff member takes back their own waiting handover; an administrator returns any.
router.post('/handovers/:id/return', async (req: AuthRequest, res, next) => {
  try {
    const id = idParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const handover = await CashService.returnHandover(id, { id: req.user!.id, isAdmin: isAdminRole(req.user!.role) }, req.body);
    publishCashEvent({ type: 'handover_returned', userId: handover.userId, handoverId: id, amount: addMoney(handover.amount), by: req.user!.username, reason: handover.returnReason });
    res.json(handover);
  } catch (error) { next(error); }
});

router.get('/debtors', async (req: AuthRequest, res, next) => {
  try {
    assertCanAcceptPayments(req.user);
    res.json(await CashService.debtors(await getAccessContext(req), req.query.search, req.query.sort));
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
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    if ([from, to].some((day) => day !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(day))) {
      return res.status(400).json({ error: 'Период задаётся датами ГГГГ-ММ-ДД' });
    }
    res.json(await CashService.listHandovers(req.query.status ? String(req.query.status) : undefined, from, to));
  } catch (error) { next(error); }
});

router.post('/handovers/:id/confirm', adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const id = idParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const handover = await CashService.confirmHandover(id, req.user!.id);
    publishCashEvent({ type: 'handover_confirmed', userId: handover.userId, handoverId: id, amount: addMoney(handover.amount), by: req.user!.username });
    res.json(handover);
  } catch (error) { next(error); }
});

router.get('/staff', adminOnly, async (_req: AuthRequest, res, next) => {
  try {
    res.json(await CashService.staffBalances());
  } catch (error) { next(error); }
});

export default router;
