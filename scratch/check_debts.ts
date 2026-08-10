import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Debt Analysis ---');

  // 1. Dashboard total debts calculation (old way)
  const invoiceTotals = await prisma.invoice.aggregate({
    where: { cancelled: false },
    _sum: {
      netAmount: true,
      paidAmount: true,
    },
  });
  const totalRevenue = Number(invoiceTotals._sum.netAmount || 0);
  const totalPaid = Number(invoiceTotals._sum.paidAmount || 0);
  const oldDashboardTotalDebts = Math.max(0, totalRevenue - totalPaid);

  console.log(`[Dashboard Old Formula] Total Revenue: ${totalRevenue}`);
  console.log(`[Dashboard Old Formula] Total Paid: ${totalPaid}`);
  console.log(`[Dashboard Old Formula] net - paid: ${oldDashboardTotalDebts}`);

  // 2. Dashboard total debts calculation (new way)
  const allInvoicesForDebts = await prisma.invoice.findMany({
    where: { cancelled: false },
    select: {
      netAmount: true,
      paidAmount: true,
    },
  });

  const newDashboardTotalDebts = allInvoicesForDebts.reduce((sum, inv) => {
    const debt = Math.max(0, Number(inv.netAmount || 0) - Number(inv.paidAmount || 0));
    return sum + debt;
  }, 0);

  console.log(`[Dashboard New Formula] Sum of invoice debts: ${newDashboardTotalDebts}`);

  // 3. Customer balance calculation (CustomerDebtsView)
  const customers = await prisma.customer.findMany({
    where: {
      NOT: {
        name: { equals: 'Обычный клиент', mode: 'insensitive' }
      }
    },
    include: {
      invoices: {
        where: { cancelled: false }
      }
    }
  });

  let totalCustomerBalancesSum = 0;
  for (const c of customers) {
    const custBalance = c.invoices.reduce((sum: number, inv: { netAmount?: number | null; paidAmount?: number | null }) => {
      const net = Number(inv.netAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      return sum + Math.max(0, net - paid);
    }, 0);
    if (custBalance > 0.01) {
      totalCustomerBalancesSum += custBalance;
    }
  }

  console.log(`[CustomerDebts Page & Print] Registered customer debts total: ${totalCustomerBalancesSum}`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
