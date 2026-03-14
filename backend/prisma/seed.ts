import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const defaultCategories = [
  'Стиральные порошки',
  'Стиральные средства',
  'Жидкие средства для стирки',
  'Средства для мытья посуды',
  'Гели для посуды',
  'Чистящие средства',
  'Средства для уборки',
  'Средства личной гигиены',
  'Шампуни и уход',
  'Мыло и антисептики',
  'Бумажная продукция',
  'Салфетки и расходники',
  'Хозяйственные товары',
  'Прочее',
] as const;

async function ensureCategory(name: string) {
  const existing = await prisma.category.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });

  if (!existing) {
    return prisma.category.create({
      data: { name },
    });
  }

  if (!existing.active) {
    return prisma.category.update({
      where: { id: existing.id },
      data: { active: true, name },
    });
  }

  return existing;
}

async function ensureCustomer(name: string, phone: string) {
  const existing = await prisma.customer.findFirst({
    where: { name },
  });

  if (existing) {
    return existing;
  }

  return prisma.customer.create({
    data: {
      name,
      phone,
    },
  });
}

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  });

  let warehouse = await prisma.warehouse.findFirst({
    where: { name: 'Main Warehouse' },
  });

  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        name: 'Main Warehouse',
        city: 'Dushanbe',
        address: 'Rudaki 10',
      },
    });
  }

  for (const categoryName of defaultCategories) {
    await ensureCategory(categoryName);
  }

  const dishwashingCategory = await ensureCategory('Средства для мытья посуды');

  let product = await prisma.product.findFirst({
    where: {
      name: 'Fairy Лимон 450мл',
      warehouseId: warehouse.id,
    },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: 'Fairy Лимон 450мл',
        unit: 'шт',
        costPrice: 14,
        sellingPrice: 18,
        categoryId: dishwashingCategory.id,
        warehouseId: warehouse.id,
        stock: 0,
        initialStock: 0,
        totalIncoming: 0,
      },
    });
  }

  const existingBatch = await prisma.productBatch.findFirst({
    where: {
      productId: product.id,
      warehouseId: warehouse.id,
    },
  });

  if (!existingBatch) {
    await prisma.productBatch.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: 50,
        remainingQuantity: 50,
        costPrice: 14,
      },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        stock: 50,
        totalIncoming: 50,
        initialStock: 50,
      },
    });
  }

  await ensureCustomer('Обычный клиент', '---');
  await ensureCustomer('Alijon Rahmonov', '+992 900 11 22 33');

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
