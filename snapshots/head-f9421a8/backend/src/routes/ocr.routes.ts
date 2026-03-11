import { Router } from 'express';
import multer from 'multer';
import { OCRService } from '../services/ocr.service.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import path from 'path';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/parse-invoice', authenticate, upload.single('invoice'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const items = await OCRService.parseInvoice(req.file.path, req.file.mimetype);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post('/invoice', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const items = await OCRService.parseInvoice(req.file.path, req.file.mimetype);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/upload', authenticate, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const photoUrl = `/uploads/${req.file.filename}`;
  res.json({ photoUrl });
});

export default router;
