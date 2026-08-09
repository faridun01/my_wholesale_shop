import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Debt Analysis ---');

  // 1. Dashboard total debts calculation
  const invoiceTotals = await prisma.invoice.aggregate({
    where: { cancelled: false },
    _sum: {
      netAmount: true,
      paidAmount: true,
    },
  });
  const totalRevenue = Number(invoiceTotals._sum.netAmount || 0);
  const totalPaid = Number(invoiceTotals._sum.paidAmount || 0);
  const dashboardTotalDebts = Math.max(0, totalRevenue - totalPaid);

  console.log(`[Dashboard] Total Revenue: ${totalRevenue}`);
  console.log(`[Dashboard] Total Paid: ${totalPaid}`);
  console.log(`[Dashboard] Calculated Total Debts (net - paid): ${dashboardTotalDebts}`);

  // 2. Breakdown of all invoices where netAmount > paidAmount
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { cancelled: false },
    include: { customer: true },
  });

  let sumIndividualInvoiceDebtsAll = 0;
  let sumIndividualInvoiceDebtsRegisteredOnly = 0;
  let defaultCustomerDebt = 0;

  for (const inv of unpaidInvoices) {
    const net = Number(inv.netAmount || 0);
    const paid = Number(inv.paidAmount || 0);
    const debt = Math.max(0, net - paid);
    sumIndividualInvoiceDebtsAll += debt;

    const custName = inv.customer?.name || 'NO_CUSTOMER';
    if (custName.toLowerCase().includes('обычный клиент') || custName.toLowerCase().includes('default')) {
      defaultCustomerDebt += debt;
    } else {
      sumIndividualInvoiceDebtsRegisteredOnly += debt;
    }
  }

  console.log(`\n[Invoices Breakdown]`);
  console.log(`Sum of max(0, net - paid) for ALL non-cancelled invoices: ${sumIndividualInvoiceDebtsAll}`);
  console.log(`Sum of max(0, net - paid) for "Обычный клиент" ONLY: ${defaultCustomerDebt}`);
  console.log(`Sum of max(0, net - paid) for REGISTERED CUSTOMERS ONLY: ${sumIndividualInvoiceDebtsRegisteredOnly}`);

  // 3. Customer balance calculation (as done in /api/customers)
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
  console.log('\n[Registered Customers List & Balances]:');
  for (const c of customers) {
    const custBalance = c.invoices.reduce((sum: number, inv: { netAmount?: number | null; paidAmount?: number | null }) => {
      const net = Number(inv.netAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      return sum + Math.max(0, net - paid);
    }, 0);
    if (custBalance > 0.01) {
      console.log(` - Customer ID ${c.id} (${c.name}): Balance = ${custBalance}`);
      totalCustomerBalancesSum += custBalance;
    }
  }

  console.log(`\n[CustomerDebts Page & Print] Sum of registered customer debts: ${totalCustomerBalancesSum}`);
  console.log(`\n[SUMMARY OF DISCREPANCY]:`);
  console.log(`Dashboard Debt (${dashboardTotalDebts}) vs Registered Customer Debts (${totalCustomerBalancesSum})`);
  console.log(`Difference: ${dashboardTotalDebts - totalCustomerBalancesSum}`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
