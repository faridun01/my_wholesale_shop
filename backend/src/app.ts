import express from 'express';
import cors from 'cors';
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
import { authenticate } from './middlewares/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
app.post('/api/upload', authenticate, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ photoUrl: `/uploads/${req.file.filename}` });
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
