import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.PORT) || 3001;

const { default: app } = await import('./app.js');

const server = app.listen(PORT, 'localhost', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Failed to start server: Error: Port ${PORT} is already in use`);
    process.exit(1);
  }

  console.error('Failed to start server:', error);
  process.exit(1);
});
