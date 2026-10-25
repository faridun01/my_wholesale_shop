import { Router } from 'express';
import { authorize, type AuthRequest } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { staffIdParamSchema, staffPeriodQuerySchema } from '../schemas/staff.schemas.js';
import { StaffStatsService, type StaffStatsPeriod } from '../services/staff-stats.service.js';
import { isAdminRole } from '../utils/access.js';

const router = Router();

const readPeriod = (query: Record<string, unknown>): StaffStatsPeriod => ({
  start: typeof query.start === 'string' ? query.start : undefined,
  end: typeof query.end === 'string' ? query.end : undefined,
  warehouseId: typeof query.warehouseId === 'number' ? query.warehouseId : null,
});

router.get(
  '/stats',
  authorize(['ADMIN']),
  validateRequest({ query: staffPeriodQuerySchema }),
  async (req: AuthRequest, res, next) => {
    try {
      res.json(await StaffStatsService.getStaffStatsList(readPeriod(req.query)));
    } catch (error) {
      next(error);
    }
  },
);

// An admin may open any staff member's card; everyone else only their own.
router.get(
  '/:id/summary',
  validateRequest({ params: staffIdParamSchema, query: staffPeriodQuerySchema }),
  async (req: AuthRequest, res, next) => {
    try {
      const targetId = Number(req.params.id);
      const isAdmin = isAdminRole(req.user?.role);

      if (String(req.user?.role || '').toUpperCase() === 'CUSTOMER') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!isAdmin && Number(req.user?.id) !== targetId) {
        return res.status(403).json({ error: 'Можно смотреть только свою статистику' });
      }

      const period = readPeriod(req.query);
      const summary = await StaffStatsService.getStaffSummary(
        targetId,
        // A seller's own figures are never narrowed to another warehouse.
        isAdmin ? period : { ...period, warehouseId: null },
        { includeProfit: isAdmin },
      );

      if (!summary) {
        return res.status(404).json({ error: 'Сотрудник не найден' });
      }

      res.json(summary);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
