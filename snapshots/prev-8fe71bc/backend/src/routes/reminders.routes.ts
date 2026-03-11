import { Router } from 'express';
import { ReminderService } from '../services/reminder.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const reminders = await ReminderService.getReminders(userId);
    res.json(reminders);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const reminder = await ReminderService.createReminder({
      ...req.body,
      userId,
    });
    res.status(201).json(reminder);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/complete', async (req, res, next) => {
  try {
    const reminder = await ReminderService.completeReminder(Number(req.params.id));
    res.json(reminder);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await ReminderService.deleteReminder(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
