import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import invoiceRoutes from './routes/invoices.routes.js';
import productRoutes from './routes/products.routes.js';
import warehouseRoutes from './routes/warehouses.routes.js';
import customerRoutes from './routes/customers.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import ocrRoutes from './routes/ocr.routes.js'
import settingsRoutes from './routes/settings.routes.js';
import reminderRoutes from './routes/reminders.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import expenseRoutes from './routes/expenses.routes.js';
import customerOrderRoutes from './routes/customer-orders.routes.js';
import { authenticate } from './middlewares/auth.middleware.js';
import { corsMiddleware, securityHeaders } from './middlewares/security.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const originalWriteHead = res.writeHead.bind(res);

  res.writeHead = ((...args: Parameters<typeof res.writeHead>) => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    res.setHeader('X-Response-Time', `${durationMs.toFixed(1)}ms`);
    return originalWriteHead(...args);
  }) as typeof res.writeHead;

  next();
});
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  immutable: true,
  maxAge: '7d',
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', authenticate, invoiceRoutes);
app.use('/api/products', authenticate, productRoutes);
app.use('/api/warehouses', authenticate, warehouseRoutes);
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/reports', authenticate, reportsRoutes);
app.use('/api/ocr', authenticate, ocrRoutes)
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/reminders', authenticate, reminderRoutes);
app.use('/api/payments', authenticate, paymentRoutes);
app.use('/api/expenses', authenticate, expenseRoutes);
app.use('/api/customer-orders', authenticate, customerOrderRoutes);
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

import { uploadImage } from './middlewares/upload.middleware.js';
app.post('/api/upload', authenticate, (req, res, next) => {
  uploadImage.single('photo')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ photoUrl: `/uploads/${req.file.filename}` });
  });
});

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);

  // Handle specific errors
  if (err.message === 'User not found' || err.message === 'Invalid password') {
    return res.status(401).json({ error: err.message });
  }

  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

export default app;
