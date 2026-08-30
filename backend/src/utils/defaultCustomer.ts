import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';

export const DEFAULT_CUSTOMER_NAME = 'Без названия';
const DEFAULT_CUSTOMER_NOTE = 'Технический клиент по умолчанию';

export const normalizeCustomerName = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const mergeCustomerRecords = async (
  client: any,
  primary: { id: number; name: string; notes?: string | null },
  duplicate: { id: number; name: string; notes?: string | null },
) => {
  await client.invoice.updateMany({
    where: { customerId: duplicate.id },
    data: { customerId: primary.id },
  });
  await client.payment.updateMany({
    where: { customerId: duplicate.id },
    data: { customerId: primary.id },
  });
  await client.return.updateMany({
    where: { customerId: duplicate.id },
    data: { customerId: primary.id },
  });
  await client.customer.update({
    where: { id: duplicate.id },
    data: {
      active: false,
      name: `${duplicate.name} [merged ${duplicate.id}]`,
      notes: duplicate.notes
        ? `${duplicate.notes}\nОбъединён с клиентом "${primary.name}" (#${primary.id}).`
        : `Объединён с клиентом "${primary.name}" (#${primary.id}).`,
    },
  });
};

export const isDefaultCustomerName = (value: string | null | undefined) =>
  normalizeCustomerName(value) === normalizeCustomerName(DEFAULT_CUSTOMER_NAME);

/**
 * Total outstanding customer debt (SUM of max(netAmount - paidAmount, 0) per invoice),
 * excluding cancelled invoices and the technical default customer. This is intentionally
 * NOT date-filtered — outstanding debt doesn't expire when a report's date range does.
 * Shared by Dashboard and Reports so the two pages never show different debt totals.
 */
export const getTotalOutstandingDebt = async (client: any = prisma, warehouseId?: number | null) => {
  const rows: Array<{ totalDebts: unknown }> = await client.$queryRaw(
    typeof warehouseId === 'number'
      ? Prisma.sql`
          SELECT COALESCE(SUM(GREATEST(i.net_amount - i.paid_amount, 0)), 0) AS "totalDebts"
          FROM invoices i
          INNER JOIN customers c ON c.id = i.customer_id
          WHERE i.cancelled = false
            AND i.warehouse_id = ${warehouseId}
            AND LOWER(c.name) <> LOWER(${DEFAULT_CUSTOMER_NAME})
        `
      : Prisma.sql`
          SELECT COALESCE(SUM(GREATEST(i.net_amount - i.paid_amount, 0)), 0) AS "totalDebts"
          FROM invoices i
          INNER JOIN customers c ON c.id = i.customer_id
          WHERE i.cancelled = false
            AND LOWER(c.name) <> LOWER(${DEFAULT_CUSTOMER_NAME})
        `
  );

  return Number(rows[0]?.totalDebts || 0);
};

export const getCanonicalDefaultCustomer = async (client: any = prisma, userId?: number | null) => {
  const defaults = await client.customer.findMany({
    where: {
      name: {
        equals: DEFAULT_CUSTOMER_NAME,
        mode: 'insensitive',
      },
    },
    orderBy: { id: 'asc' },
  });

  let primary = defaults[0] ?? null;

  if (!primary) {
    primary = await client.customer.create({
      data: {
        name: DEFAULT_CUSTOMER_NAME,
        city: null,
        createdByUserId: userId ?? null,
        active: true,
        notes: DEFAULT_CUSTOMER_NOTE,
      },
    });
    return primary;
  }

  if (!primary.active || primary.name !== DEFAULT_CUSTOMER_NAME || primary.city !== null) {
    primary = await client.customer.update({
      where: { id: primary.id },
      data: {
        name: DEFAULT_CUSTOMER_NAME,
        active: true,
        city: null,
        notes: primary.notes || DEFAULT_CUSTOMER_NOTE,
      },
    });
  }

  const duplicates = defaults.slice(1);
  for (const duplicate of duplicates) {
    await mergeCustomerRecords(client, primary, duplicate);
  }

  return primary;
};

export const mergeDuplicateCustomers = async (client: any = prisma, userId?: number | null) => {
  const defaultCustomer = await getCanonicalDefaultCustomer(client, userId);
  const customers = await client.customer.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      notes: true,
      active: true,
    },
  });

  const groups = new Map<string, Array<{ id: number; name: string; notes?: string | null; active: boolean }>>();
  for (const customer of customers) {
    const key = normalizeCustomerName(customer.name);
    if (!key) {
      continue;
    }

    const group = groups.get(key) || [];
    group.push(customer);
    groups.set(key, group);
  }

  for (const [key, group] of groups.entries()) {
    if (group.length <= 1) {
      continue;
    }

    let primary =
      key === normalizeCustomerName(DEFAULT_CUSTOMER_NAME)
        ? group.find((customer) => customer.id === defaultCustomer.id) || group[0]
        : group.find((customer) => customer.active) || group[0];

    const canonicalName = key === normalizeCustomerName(DEFAULT_CUSTOMER_NAME) ? DEFAULT_CUSTOMER_NAME : String(primary.name || '').trim();
    primary = await client.customer.update({
      where: { id: primary.id },
      data: {
        name: canonicalName,
        active: true,
      },
    });

    for (const duplicate of group) {
      if (duplicate.id === primary.id) {
        continue;
      }

      await mergeCustomerRecords(client, primary, duplicate);
    }
  }

  return defaultCustomer;
};
