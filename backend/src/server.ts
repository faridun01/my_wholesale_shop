import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

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

const maskDatabaseUrl = (databaseUrl: string) => {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
};

const resolveLoadedEnvPath = () => {
  for (const envPath of envCandidates) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      return envPath;
    }
  }

  return null;
};

const loadedEnvPath = resolveLoadedEnvPath();

const printDatabaseConnectionHelp = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown database initialization error';
  const databaseUrl = process.env.DATABASE_URL;

  console.error('Failed to initialize database connection.');
  console.error(message);

  if (databaseUrl) {
    console.error(`DATABASE_URL: ${maskDatabaseUrl(databaseUrl)}`);
  } else {
    console.error('DATABASE_URL is not set.');
  }

  if (loadedEnvPath) {
    console.error(`Loaded environment file: ${loadedEnvPath}`);
  }

  console.error('Check that PostgreSQL is running and the username/password in backend/.env are correct.');
};

try {
  const { initRateLimitStorage } = await import('./middlewares/rate-limit.middleware.js');
  await initRateLimitStorage();
} catch (error) {
  printDatabaseConnectionHelp(error);
  process.exit(1);
}

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
