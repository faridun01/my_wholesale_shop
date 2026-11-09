import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Fail closed if a financial integration run could route any module to the
// ordinary application database, even when a fixture forgets to inject its client.
if (process.env.FINANCIAL_TEST_DATABASE_URL) {
  const target = new URL(process.env.FINANCIAL_TEST_DATABASE_URL);
  if (!/^\/[a-zA-Z0-9_]+_financial_test$/.test(target.pathname) || process.env.DATABASE_URL !== process.env.FINANCIAL_TEST_DATABASE_URL) {
    throw new Error('Financial tests require DATABASE_URL to match the isolated _financial_test database');
  }
}

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
  ],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
