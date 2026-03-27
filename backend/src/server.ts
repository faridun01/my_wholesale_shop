import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath });
}

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const { initRateLimitStorage } = await import('./middlewares/rate-limit.middleware.js');
await initRateLimitStorage();
const { default: app } = await import('./app.js');

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Failed to start server: Error: Port ${PORT} is already in use`);
    process.exit(1);
  }

  console.error('Failed to start server:', error);
  process.exit(1);
});
