import { Router } from 'express';
import { OCRService } from '../services/ocr.service.js';
import fs from 'fs';
import { createRateLimit } from '../middlewares/rate-limit.middleware.js';
import { securityConfig } from '../config/security.js';
import { imageUpload, ocrUpload } from '../utils/upload.js';

const router = Router();

const uploadRateLimit = createRateLimit({
  windowMs: securityConfig.rateLimit.uploadWindowMs,
  maxAttempts: securityConfig.rateLimit.uploadMaxAttempts,
  blockMs: securityConfig.rateLimit.uploadBlockMs,
  message: 'Too many file upload attempts. Please try again later.',
});

router.post('/parse-invoice', uploadRateLimit, ocrUpload.single('invoice'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const items = await OCRService.parseInvoice(req.file.path, req.file.mimetype);

    res.json(items);
  } catch (error: any) {
    if (Number(error?.status) === 503) {
      return res.status(503).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || 'OCR parse failed' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

router.post('/invoice', uploadRateLimit, ocrUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const items = await OCRService.parseInvoice(req.file.path, req.file.mimetype);

    res.json({ items });
  } catch (error: any) {
    if (Number(error?.status) === 503) {
      return res.status(503).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || 'OCR parse failed' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

router.post('/upload', uploadRateLimit, imageUpload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const photoUrl = `/uploads/${req.file.filename}`;
  res.json({ photoUrl });
});

export default router;
