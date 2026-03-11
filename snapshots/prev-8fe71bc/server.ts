import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const app = express();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "9e8b6a0c8b4f43d6b2b1a3c7d9e4f6a7c8d2e1f5b6a9c0d4e7f8a1b2c3d4e5f6";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not found. Gemini features are disabled.");
}

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static(uploadsDir));

type JwtPayload = {
  id: number;
  username: string;
  role: string;
  warehouseId: number | null;
};

type AuthRequest = express.Request & {
  user?: JwtPayload;
};

function signToken(user: JwtPayload) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

function auth(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Токен отсутствует" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;

    next();
  } catch (error) {
    console.error("AUTH ERROR:", error);
    return res.status(401).json({ error: "Неверный или просроченный токен" });
  }
}

function allowRoles(roles: string[]) {
  const normalized = roles.map((r) => r.toLowerCase());

  return (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    if (!normalized.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({ error: "Недостаточно прав" });
    }

    next();
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    const warehouseCount = await prisma.warehouse.count();
    const productCount = await prisma.product.count();
    const customerCount = await prisma.customer.count();

    return res.json({
      status: "ok",
      warehouseCount,
      productCount,
      customerCount,
      geminiEnabled: !!ai,
    });
  } catch (error) {
    console.error("HEALTH ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/upload", upload.single("photo"), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  return res.json({
    photoUrl: `/uploads/${req.file.filename}`,
  });
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return res.status(400).json({ error: "Введите username и password" });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.active === false) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }

    const passwordHash = (user as any).passwordHash ?? (user as any).password ?? "";

    const isMatch =
      passwordHash.startsWith("$2a$") ||
      passwordHash.startsWith("$2b$") ||
      passwordHash.startsWith("$2y$")
        ? await bcrypt.compare(password, passwordHash)
        : password === passwordHash;

    if (!isMatch) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }

    const payload: JwtPayload = {
      id: user.id,
      username: user.username,
      role: String(user.role).toLowerCase(),
      warehouseId: (user as any).warehouseId ?? null,
    };

    const token = signToken(payload);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: String(user.role).toLowerCase(),
        warehouseId: (user as any).warehouseId ?? null,
        canCancel: Boolean((user as any).canCancel ?? false),
        canDelete: Boolean((user as any).canDelete ?? false),
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ error: "Ошибка входа" });
  }
});

app.get("/api/users", auth, allowRoles(["admin"]), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      include: {
        warehouse: true,
      },
      orderBy: { id: "asc" },
    });

    return res.json(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        role: String(u.role).toLowerCase(),
        warehouse_id: (u as any).warehouseId ?? null,
        warehouse_name: u.warehouse
          ? (u.warehouse as any).name ?? (u.warehouse as any).name_address ?? null
          : null,
        can_cancel: Boolean((u as any).canCancel ?? false),
        can_delete: Boolean((u as any).canDelete ?? false),
        active: u.active,
      }))
    );
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    return res.status(500).json({ error: "Ошибка получения пользователей" });
  }
});

app.post("/api/users", auth, allowRoles(["admin"]), async (req, res) => {
  try {
    const { username, password, role, warehouse_id, can_cancel, can_delete } =
      req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "username и password обязательны" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPassword,
        role: String(role || "SELLER").toUpperCase() as any,
        warehouseId: warehouse_id ?? null,
        canCancel: Boolean(can_cancel),
        canDelete: Boolean(can_delete),
        active: true,
      } as any,
    });

    return res.json({ id: user.id });
  } catch (error: any) {
    console.error("CREATE USER ERROR:", error);
    return res
      .status(400)
      .json({ error: error.message || "Ошибка создания пользователя" });
  }
});

app.put("/api/users/:id", auth, allowRoles(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      username,
      password,
      role,
      warehouse_id,
      can_cancel,
      can_delete,
      active,
    } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const data: any = {};

    if (username !== undefined) data.username = username;
    if (role !== undefined) data.role = String(role).toUpperCase();
    if (warehouse_id !== undefined) data.warehouseId = warehouse_id;
    if (can_cancel !== undefined) data.canCancel = Boolean(can_cancel);
    if (can_delete !== undefined) data.canDelete = Boolean(can_delete);
    if (active !== undefined) data.active = Boolean(active);

    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    await prisma.user.update({
      where: { id },
      data,
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error("UPDATE USER ERROR:", error);
    return res
      .status(400)
      .json({ error: error.message || "Ошибка обновления пользователя" });
  }
});

app.delete("/api/users/:id", auth, allowRoles(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    return res.status(500).json({ error: "Ошибка удаления пользователя" });
  }
});

app.get("/api/warehouses", auth, async (_req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { active: true as any },
      orderBy: { id: "asc" },
    });

    return res.json(warehouses);
  } catch (error) {
    console.error("GET WAREHOUSES ERROR:", error);
    return res.status(500).json({ error: "Ошибка получения складов" });
  }
});

app.post(
  "/api/warehouses",
  auth,
  allowRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const { name, city, note, name_address } = req.body;

      const warehouse = await prisma.warehouse.create({
        data: {
          name: name ?? name_address ?? "Новый склад",
          city: city ?? null,
          note: note ?? null,
          active: true as any,
        } as any,
      });

      return res.json({ id: warehouse.id });
    } catch (error: any) {
      console.error("CREATE WAREHOUSE ERROR:", error);
      return res
        .status(400)
        .json({ error: error.message || "Ошибка создания склада" });
    }
  }
);

app.put(
  "/api/warehouses/:id",
  auth,
  allowRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, city, note, name_address, active } = req.body;

      await prisma.warehouse.update({
        where: { id },
        data: {
          name: name ?? name_address,
          city,
          note,
          ...(active !== undefined ? { active: Boolean(active) as any } : {}),
        } as any,
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error("UPDATE WAREHOUSE ERROR:", error);
      return res
        .status(400)
        .json({ error: error.message || "Ошибка обновления склада" });
    }
  }
);

app.delete(
  "/api/warehouses/:id",
  auth,
  allowRoles(["admin"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      await prisma.warehouse.update({
        where: { id },
        data: { active: false as any },
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("DELETE WAREHOUSE ERROR:", error);
      return res.status(500).json({ error: "Ошибка удаления склада" });
    }
  }
);

app.get("/api/products", auth, async (req, res) => {
  try {
    const warehouseId =
      req.query.warehouse_id !== undefined
        ? Number(req.query.warehouse_id)
        : null;

    const products = await prisma.product.findMany({
      where: { active: true as any },
      orderBy: { id: "desc" },
    });

    if (warehouseId == null) {
      return res.json(products);
    }

    const productIds = products.map((p) => p.id);

    const batches =
      "batch" in prisma
        ? await (prisma as any).batch.groupBy({
            by: ["productId"],
            where: {
              warehouseId,
              productId: { in: productIds },
            },
            _sum: {
              quantityRemaining: true,
              quantityReceived: true,
            },
          })
        : [];

    const stockMap = new Map<number, { stock: number; total_incoming: number }>();

    for (const row of batches) {
      stockMap.set(row.productId, {
        stock: Number(row._sum.quantityRemaining || 0),
        total_incoming: Number(row._sum.quantityReceived || 0),
      });
    }

    return res.json(
      products.map((p) => ({
        ...p,
        stock: stockMap.get(p.id)?.stock ?? 0,
        total_incoming: stockMap.get(p.id)?.total_incoming ?? 0,
      }))
    );
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    return res.status(500).json({ error: "Ошибка получения товаров" });
  }
});

app.post(
  "/api/products",
  auth,
  allowRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const {
        name,
        unit,
        selling_price,
        min_stock,
        photo_url,
        warehouse_id,
        initial_stock,
        cost_price,
      } = req.body;

      const product = await prisma.product.create({
        data: {
          name,
          unit,
          sellingPrice: Number(selling_price ?? 0),
          minStock: Number(min_stock ?? 0),
          photoUrl: photo_url ?? null,
          active: true as any,
        } as any,
      });

      if ((initial_stock ?? 0) > 0 && "batch" in prisma) {
        await (prisma as any).batch.create({
          data: {
            productId: product.id,
            warehouseId: Number(warehouse_id),
            purchasePrice: Number(cost_price ?? 0),
            quantityReceived: Number(initial_stock),
            quantityRemaining: Number(initial_stock),
            receivedAt: new Date(),
          },
        });
      }

      return res.json({ id: product.id });
    } catch (error: any) {
      console.error("CREATE PRODUCT ERROR:", error);
      return res
        .status(400)
        .json({ error: error.message || "Ошибка создания товара" });
    }
  }
);

app.put(
  "/api/products/:id",
  auth,
  allowRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, unit, selling_price, min_stock, photo_url, active } =
        req.body;

      await prisma.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(unit !== undefined ? { unit } : {}),
          ...(selling_price !== undefined
            ? { sellingPrice: Number(selling_price) }
            : {}),
          ...(min_stock !== undefined ? { minStock: Number(min_stock) } : {}),
          ...(photo_url !== undefined ? { photoUrl: photo_url } : {}),
          ...(active !== undefined ? { active: Boolean(active) as any } : {}),
        } as any,
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error("UPDATE PRODUCT ERROR:", error);
      return res
        .status(400)
        .json({ error: error.message || "Ошибка обновления товара" });
    }
  }
);

app.delete(
  "/api/products/:id",
  auth,
  allowRoles(["admin"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      await prisma.product.update({
        where: { id },
        data: { active: false as any },
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("DELETE PRODUCT ERROR:", error);
      return res.status(500).json({ error: "Ошибка удаления товара" });
    }
  }
);

app.get("/api/customers", auth, async (_req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { id: "desc" },
    });

    return res.json(customers);
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    return res.status(500).json({ error: "Ошибка получения клиентов" });
  }
});

app.post(
  "/api/customers",
  auth,
  allowRoles(["admin", "manager", "seller"]),
  async (req, res) => {
    try {
      const { name, phone, address, notes } = req.body;

      const customer = await prisma.customer.create({
        data: {
          name,
          phone: phone ?? null,
          address: address ?? null,
          notes: notes ?? null,
        } as any,
      });

      return res.json({ id: customer.id });
    } catch (error: any) {
      console.error("CREATE CUSTOMER ERROR:", error);
      return res
        .status(400)
        .json({ error: error.message || "Ошибка создания клиента" });
    }
  }
);

app.put(
  "/api/customers/:id",
  auth,
  allowRoles(["admin", "manager", "seller"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, phone, address, notes } = req.body;

      await prisma.customer.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(notes !== undefined ? { notes } : {}),
        } as any,
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error("UPDATE CUSTOMER ERROR:", error);
      return res
        .status(400)
        .json({ error: error.message || "Ошибка обновления клиента" });
    }
  }
);

app.delete(
  "/api/customers/:id",
  auth,
  allowRoles(["admin"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      await prisma.customer.delete({
        where: { id },
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("DELETE CUSTOMER ERROR:", error);
      return res.status(500).json({ error: "Ошибка удаления клиента" });
    }
  }
);

app.get("/api/invoices", auth, async (_req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        user: true,
      },
      orderBy: { createdAt: "desc" },
    } as any);

    return res.json(invoices);
  } catch (error) {
    console.error("GET INVOICES ERROR:", error);
    return res.status(500).json({ error: "Ошибка получения продаж" });
  }
});

app.post(
  "/api/invoices",
  auth,
  allowRoles(["admin", "manager", "seller"]),
  async (req: AuthRequest, res) => {
    try {
      const {
        customer_id,
        warehouse_id,
        items,
        discount,
        tax,
        payment_amount,
        payment_method,
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Нет товаров в продаже" });
      }

      const result = await prisma.$transaction(async (tx) => {
        let totalAmount = 0;

        for (const item of items) {
          totalAmount += Number(item.quantity) * Number(item.selling_price);
        }

        const finalTotal =
          totalAmount -
          (totalAmount * Number(discount || 0)) / 100 +
          Number(tax || 0);

        const invoice = await tx.invoice.create({
          data: {
            customerId: Number(customer_id),
            warehouseId: Number(warehouse_id),
            totalAmount,
            discount: Number(discount || 0),
            tax: Number(tax || 0),
            status:
              Number(payment_amount || 0) >= finalTotal
                ? "PAID"
                : Number(payment_amount || 0) > 0
                ? "PARTIAL"
                : "DEBT",
            userId: Number(req.user?.id),
          } as any,
        });

        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: Number(item.product_id) },
          });

          if (!product) {
            throw new Error(`Товар ${item.product_id} не найден`);
          }

          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              productId: product.id,
              quantity: Number(item.quantity),
              sellingPrice: Number(item.selling_price),
              purchasePrice: Number((product as any).costPrice ?? 0),
              lineTotal: Number(item.quantity) * Number(item.selling_price),
              lineCost:
                Number(item.quantity) * Number((product as any).costPrice ?? 0),
              profit:
                Number(item.quantity) *
                (Number(item.selling_price) -
                  Number((product as any).costPrice ?? 0)),
            } as any,
          });

          if ("batch" in tx) {
            const neededQty = Number(item.quantity);
            let remaining = neededQty;

            const batches = await (tx as any).batch.findMany({
              where: {
                productId: product.id,
                warehouseId: Number(warehouse_id),
                quantityRemaining: { gt: 0 },
              },
              orderBy: { receivedAt: "asc" },
            });

            for (const batch of batches) {
              if (remaining <= 0) break;

              const take = Math.min(
                Number(batch.quantityRemaining),
                remaining
              );

              await (tx as any).batch.update({
                where: { id: batch.id },
                data: {
                  quantityRemaining: Number(batch.quantityRemaining) - take,
                },
              });

              remaining -= take;
            }

            if (remaining > 0) {
              throw new Error(`Недостаточно остатка для товара ${product.name}`);
            }
          }

          if ("inventoryTransaction" in tx) {
            await (tx as any).inventoryTransaction.create({
              data: {
                productId: product.id,
                warehouseId: Number(warehouse_id),
                type: "OUT",
                quantity: Number(item.quantity),
                unitCost: Number((product as any).costPrice ?? 0),
                referenceType: "invoice",
                referenceId: invoice.id,
              },
            });
          }
        }

        if (Number(payment_amount || 0) > 0) {
          await tx.payment.create({
            data: {
              customerId: Number(customer_id),
              invoiceId: invoice.id,
              amount: Number(payment_amount),
              method: String(payment_method || "cash"),
              userId: Number(req.user?.id),
            } as any,
          });
        }

        return invoice;
      });

      return res.json({ id: result.id });
    } catch (error: any) {
      console.error("CREATE INVOICE ERROR:", error);
      return res
        .status(400)
        .json({ error: error.message || "Ошибка создания продажи" });
    }
  }
);

app.get("/api/ai/health", auth, (_req, res) => {
  return res.json({
    ok: true,
    geminiEnabled: !!ai,
  });
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("UNHANDLED ERROR:", err);
    return res.status(500).json({
      error: "Внутренняя ошибка сервера",
    });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});