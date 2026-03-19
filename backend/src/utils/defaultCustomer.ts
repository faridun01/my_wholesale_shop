import prisma from '../db/prisma.js';

export const DEFAULT_CUSTOMER_NAME = 'Без названия';
const DEFAULT_CUSTOMER_NOTE = 'Технический клиент по умолчанию';

const normalizeName = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

export const isDefaultCustomerName = (value: string | null | undefined) =>
  normalizeName(value) === normalizeName(DEFAULT_CUSTOMER_NAME);

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
        notes: duplicate.notes
          ? `${duplicate.notes}\nОбъединён с клиентом "${DEFAULT_CUSTOMER_NAME}" (#${primary.id}).`
          : `Объединён с клиентом "${DEFAULT_CUSTOMER_NAME}" (#${primary.id}).`,
      },
    });
  }

  return primary;
};
