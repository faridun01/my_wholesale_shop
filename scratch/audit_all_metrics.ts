import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('   FULL SYSTEM DATABASE METRICS AUDIT REPORT       ');
  console.log('====================================================\n');

  // 1. Total Revenue
  const revenueAgg = await prisma.invoice.aggregate({
    where: { cancelled: false },
    _sum: { netAmount: true, paidAmount: true },
    _count: true,
  });
  const totalRevenue = Number(revenueAgg._sum.netAmount || 0);
  const totalPaid = Number(revenueAgg._sum.paidAmount || 0);

  console.log(`1. ВЫРУЧКА (Total Revenue):`);
  console.log(`   - Всего выписано на сумму: ${totalRevenue.toLocaleString('ru-RU')} TJS`);
  console.log(`   - Из них фактически получено: ${totalPaid.toLocaleString('ru-RU')} TJS`);

  // 2. Total Orders
  const totalOrders = revenueAgg._count;
  console.log(`\n2. ЗАКАЗЫ (Total Orders):`);
  console.log(`   - Всего действующих накладных (не отменённых): ${totalOrders}`);

  // 3. Customers
  const totalCustomers = await prisma.customer.count({
    where: {
      active: true,
      NOT: { name: { equals: 'Обычный клиент', mode: 'insensitive' } },
    },
  });
  const defaultCustomer = await prisma.customer.findFirst({
    where: { name: { equals: 'Обычный клиент', mode: 'insensitive' } },
  });
  console.log(`\n3. КЛИЕНТЫ (Total Registered Customers):`);
  console.log(`   - Зарегистрированных клиентов (без Обычный клиент): ${totalCustomers}`);
  console.log(`   - Системный "Обычный клиент" существует: ${Boolean(defaultCustomer)}`);

  // 4. Products in Stock
  const allActiveProducts = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, stock: true, costPrice: true, sellingPrice: true },
  });
  const uniqueProductsCount = new Set(allActiveProducts.map((p) => p.name.trim().toLowerCase())).size;
  const inStockProducts = allActiveProducts.filter((p) => Number(p.stock) > 0);
  const uniqueInStockCount = new Set(inStockProducts.map((p) => p.name.trim().toLowerCase())).size;

  console.log(`\n4. ТОВАРЫ В НАЛИЧИИ (Products in Stock):`);
  console.log(`   - Всего уникальных наименований в каталоге: ${uniqueProductsCount}`);
  console.log(`   - Уникальных наименований с остатком > 0: ${uniqueInStockCount}`);

  // 5. Today's Sales
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const todaySalesAgg = await prisma.invoice.aggregate({
    where: {
      cancelled: false,
      createdAt: { gte: todayStart, lt: tomorrowStart },
    },
    _sum: { netAmount: true },
    _count: true,
  });
  console.log(`\n5. ПРОДАЖИ ЗА СЕГОДНЯ (Today's Sales):`);
  console.log(`   - Сумма продаж за сегодня: ${Number(todaySalesAgg._sum.netAmount || 0).toLocaleString('ru-RU')} TJS`);
  console.log(`   - Заказов за сегодня: ${todaySalesAgg._count}`);

  // 6. Customer Debts
  const allInvoices = await prisma.invoice.findMany({
    where: { cancelled: false },
    select: { id: true, netAmount: true, paidAmount: true, customerId: true, customer: { select: { name: true } } },
  });

  let totalInvoiceDebtsAll = 0;
  let totalInvoiceDebtsRegistered = 0;
  let totalInvoiceDebtsDefaultCust = 0;

  for (const inv of allInvoices) {
    const net = Number(inv.netAmount || 0);
    const paid = Number(inv.paidAmount || 0);
    const debt = Math.max(0, net - paid);

    totalInvoiceDebtsAll += debt;
    const custName = inv.customer?.name || '';
    if (custName.toLowerCase().includes('обычный клиент')) {
      totalInvoiceDebtsDefaultCust += debt;
    } else {
      totalInvoiceDebtsRegistered += debt;
    }
  }

  // Calculate debt per registered customer
  const customersWithInvoices = await prisma.customer.findMany({
    where: { active: true, NOT: { name: { equals: 'Обычный клиент', mode: 'insensitive' } } },
    include: { invoices: { where: { cancelled: false } } },
  });

  let totalCustomerBalancesSum = 0;
  for (const c of customersWithInvoices) {
    const cDebt = c.invoices.reduce((sum, inv) => {
      const net = Number(inv.netAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      return sum + Math.max(0, net - paid);
    }, 0);
    if (cDebt > 0.01) {
      totalCustomerBalancesSum += cDebt;
    }
  }

  console.log(`\n6. ДОЛГИ КЛИЕНТОВ (Customer Debts):`);
  console.log(`   - Сумма по всем невыплаченным накладным (новое решение в Дашборде): ${totalInvoiceDebtsAll.toLocaleString('ru-RU')} TJS`);
  console.log(`   - Задолженность зарегистрированных клиентов (Долги клиентов & Печать): ${totalCustomerBalancesSum.toLocaleString('ru-RU')} TJS`);
  console.log(`   - Задолженность по "Обычный клиент" (если есть нераспределённый остаток): ${totalInvoiceDebtsDefaultCust.toLocaleString('ru-RU')} TJS`);

  // 7. Inventory Stock Value
  const batches = await prisma.productBatch.findMany({
    where: { remainingQuantity: { gt: 0 } },
    select: { remainingQuantity: true, costPrice: true },
  });
  const inventoryCostValueFromBatches = batches.reduce(
    (sum, b) => sum + Number(b.remainingQuantity || 0) * Number(b.costPrice || 0),
    0
  );

  const inventoryCostValueFromProducts = allActiveProducts.reduce(
    (sum, p) => sum + Math.max(0, Number(p.stock || 0)) * Number(p.costPrice || 0),
    0
  );

  const inventoryRetailValueFromProducts = allActiveProducts.reduce(
    (sum, p) => sum + Math.max(0, Number(p.stock || 0)) * Number(p.sellingPrice || 0),
    0
  );

  console.log(`\n7. СУММА ТОВАРОВ НА СКЛАДЕ (Inventory Stock Value):`);
  console.log(`   - По закупочным партиям (FIFO/Batches Cost Value): ${inventoryCostValueFromBatches.toLocaleString('ru-RU')} TJS`);
  console.log(`   - По себестоимости товаров (Products Cost Price Value): ${inventoryCostValueFromProducts.toLocaleString('ru-RU')} TJS`);
  console.log(`   - По продажной стоимости (Retail Selling Price Value): ${inventoryRetailValueFromProducts.toLocaleString('ru-RU')} TJS`);

  console.log('\n====================================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
