import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
const source = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) throw new Error('Integration runner only provisions local test databases');
const name = `codex_${Date.now()}_financial_test`;
const admin = new PrismaClient({ datasources: { db: { url: source.toString() } } });
const backend = fileURLToPath(new URL('../', import.meta.url));
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`); created = true;
  const test = new URL(source); test.pathname = `/${name}`;
  const env = { ...process.env, DATABASE_URL: test.toString(), FINANCIAL_TEST_DATABASE_URL: test.toString() };
  const migrate = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { cwd: backend, env, stdio: 'inherit' });
  if (migrate.status !== 0) throw new Error('Isolated migration failed');
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)), 'run', '--no-cache', ...process.argv.slice(2)], { cwd: backend, env, stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
} finally {
  // Exact name created in this invocation, on a verified local server only.
  if (created && /^codex_\d+_financial_test$/.test(name)) await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.$disconnect();
}
