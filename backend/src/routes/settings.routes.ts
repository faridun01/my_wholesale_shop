import { Router } from 'express';
import { SettingsService } from '../services/settings.service.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/public', async (req, res, next) => {
  try {
    const settings = await SettingsService.getSettings();
    res.json({
      priceVisibility: settings.priceVisibility || 'everyone',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const settings = await SettingsService.getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { key, value } = req.body;
    const setting = await SettingsService.updateSetting(key, value);
    res.json(setting);
  } catch (error) {
    next(error);
  }
});

router.get('/categories', authenticate, async (req, res, next) => {
  try {
    const categories = await SettingsService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

router.post('/categories', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const category = await SettingsService.ensureCategory(req.body?.name);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

export default router;
