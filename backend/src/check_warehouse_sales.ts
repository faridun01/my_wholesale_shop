import prisma from './db/prisma.js';

async function main() {
  const warehouses = await prisma.warehouse.findMany();
  
  const invoices = await prisma.invoice.findMany({
    where: { cancelled: false },
    include: {
      warehouse: true,
      customer: true,
    },
  });

  console.log('\n================ СТАТИСТИКА ПРОДАЖ ПО СКЛАДАМ ================');

  for (const wh of warehouses) {
    const whInvoices = invoices.filter(i => i.warehouseId === wh.id);
    const count = whInvoices.length;
    
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalDebtAll = 0;
    let totalDebtRealCustomers = 0;

    for (const inv of whInvoices) {
      const net = Number(inv.netAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      const debt = Math.max(0, net - paid);

      totalRevenue += net;
      totalPaid += paid;
      totalDebtAll += debt;

      if (inv.customer?.name !== 'Без названия') {
        totalDebtRealCustomers += debt;
      }
    }

    console.log(`\n📦 Склад: "${wh.name}" (ID: ${wh.id}, Город: ${wh.city || 'Не указан'})`);
    console.log(`   • Количество продаж (накладных): ${count}`);
    console.log(`   • Общая сумма продаж (выручка): ${totalRevenue.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} TJS`);
    console.log(`   • Оплачено: ${totalPaid.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} TJS`);
    console.log(`   • Остаток долга (реальные клиенты): ${totalDebtRealCustomers.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} TJS`);
  }

  console.log('\n===============================================================\n');

  await prisma.$disconnect();
}

main().catch(console.error);
