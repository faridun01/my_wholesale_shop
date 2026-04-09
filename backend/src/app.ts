import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import invoiceRoutes from './routes/invoices.routes.js';
import productRoutes from './routes/products.routes.js';
import warehouseRoutes from './routes/warehouses.routes.js';
import customerRoutes from './routes/customers.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import ocrRoutes from './routes/ocr.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import reminderRoutes from './routes/reminders.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import expenseRoutes from './routes/expenses.routes.js';
import { authenticate, authenticateUploadAccess } from './middlewares/auth.middleware.js';
import { corsMiddleware, securityHeaders } from './middlewares/security.middleware.js';
import { allowedImageMimeTypes, assertFileSignature, imageUpload, uploadsDir } from './utils/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const trustProxySetting = process.env.TRUST_PROXY;

if (trustProxySetting === 'true') {
  app.set('trust proxy', true);
} else if (trustProxySetting === 'false') {
  app.set('trust proxy', false);
} else if (trustProxySetting && Number.isFinite(Number(trustProxySetting))) {
  app.set('trust proxy', Number(trustProxySetting));
} else if (trustProxySetting) {
  app.set('trust proxy', trustProxySetting);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.get('/api/uploads/:filename', authenticateUploadAccess, (req, res) => {
  const requestedName = String(req.params.filename || '');
  const safeName = path.basename(requestedName);

  if (!safeName || safeName !== requestedName) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const filePath = path.join(uploadsDir, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', authenticate, invoiceRoutes);
app.use('/api/products', authenticate, productRoutes);
app.use('/api/warehouses', authenticate, warehouseRoutes);
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/reports', authenticate, reportsRoutes);
app.use('/api/ocr', authenticate, ocrRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/reminders', authenticate, reminderRoutes);
app.use('/api/payments', authenticate, paymentRoutes);
app.use('/api/expenses', authenticate, expenseRoutes);

app.post('/api/upload', authenticate, imageUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await assertFileSignature(req.file.path, allowedImageMimeTypes);
    res.json({ photoUrl: `/api/uploads/${req.file.filename}` });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (err.message === 'Invalid credentials') {
    return res.status(401).json({ error: err.message });
  }

  if (err.message === 'Unsupported file type') {
    return res.status(400).json({ error: 'Only JPG, PNG, WEBP images and PDF files are allowed' });
  }

  if (err.message === 'Invalid file signature') {
    return res.status(400).json({ error: 'The uploaded file content does not match its declared type' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Uploaded file is too large' });
  }

  if (typeof err.status === 'number') {
    if (err.status >= 500) {
      return res.status(err.status).json({ error: 'Internal server error' });
    }

    return res.status(err.status).json({ error: err.message || 'Request failed' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
