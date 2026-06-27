import { Router } from "express";
import { db, subAccountsTable, bankAccountsTable, walletAccountsTable, paymentMethodsTable, expenseCategoriesTable, appSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { hashPassword, verifyPassword, signJwt } from "../lib/auth";
import { authMiddleware, type AuthRequest } from "../lib/middleware";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const [user] = await db.select().from(subAccountsTable).where(eq(subAccountsTable.email, email));
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (!user.active) {
      res.status(403).json({ error: "Account is deactivated" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signJwt({ id: user.id, role: user.role || "employee" });
    const { password: _, passwordHash: __, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const [user] = await db.select().from(subAccountsTable).where(eq(subAccountsTable.id, authReq.user!.id));
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    const { password: _, passwordHash: __, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.get("/sub-accounts", authMiddleware, async (_req, res) => {
  const rows = await db.select().from(subAccountsTable).orderBy(desc(subAccountsTable.createdAt));
  res.json(rows.map(r => {
    const { password: _, passwordHash: __, ...rest } = r;
    return rest;
  }));
});

router.post("/sub-accounts", authMiddleware, async (req, res) => {
  const { password, ...rest } = req.body;
  const passwordHash = password ? await hashPassword(password) : null;
  const row = await db.insert(subAccountsTable).values({ ...rest, passwordHash }).returning();
  const { password: _, passwordHash: __, ...safeUser } = row[0];
  res.status(201).json(safeUser);
});

router.put("/sub-accounts/:id", authMiddleware, async (req, res) => {
  const { password, ...rest } = req.body;
  const updates: any = { ...rest };
  if (password) updates.passwordHash = await hashPassword(password);
  const id = req.params.id as string;
  const row = await db.update(subAccountsTable).set(updates).where(eq(subAccountsTable.id, id)).returning();
  const { password: _, passwordHash: __, ...safeUser } = row[0];
  res.json(safeUser);
});

router.delete("/sub-accounts/:id", authMiddleware, async (req, res) => {
  const id = req.params.id as string;
  await db.delete(subAccountsTable).where(eq(subAccountsTable.id, id));
  res.json({ ok: true });
});

router.get("/bank-accounts", async (_req, res) => {
  const rows = await db.select().from(bankAccountsTable);
  res.json(rows);
});

router.post("/bank-accounts", async (req, res) => {
  const row = await db.insert(bankAccountsTable).values(req.body).returning();
  res.status(201).json(row[0]);
});

router.put("/bank-accounts/:id", async (req, res) => {
  const row = await db.update(bankAccountsTable).set(req.body).where(eq(bankAccountsTable.id, req.params.id)).returning();
  res.json(row[0]);
});

router.delete("/bank-accounts/:id", async (req, res) => {
  await db.delete(bankAccountsTable).where(eq(bankAccountsTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/wallet-accounts", async (_req, res) => {
  const rows = await db.select().from(walletAccountsTable);
  res.json(rows);
});

router.post("/wallet-accounts", async (req, res) => {
  const row = await db.insert(walletAccountsTable).values(req.body).returning();
  res.status(201).json(row[0]);
});

router.put("/wallet-accounts/:id", async (req, res) => {
  const row = await db.update(walletAccountsTable).set(req.body).where(eq(walletAccountsTable.id, req.params.id)).returning();
  res.json(row[0]);
});

router.delete("/wallet-accounts/:id", async (req, res) => {
  await db.delete(walletAccountsTable).where(eq(walletAccountsTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/expense-categories", async (_req, res) => {
  const rows = await db.select().from(expenseCategoriesTable);
  res.json(rows.map(r => r.name));
});

router.post("/expense-categories", async (req, res) => {
  await db.insert(expenseCategoriesTable).values({ name: req.body.name });
  res.status(201).json({ ok: true });
});

router.delete("/expense-categories/:name", async (req, res) => {
  await db.delete(expenseCategoriesTable).where(eq(expenseCategoriesTable.name, req.params.name));
  res.json({ ok: true });
});

router.get("/settings/:key", async (req, res) => {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, req.params.key));
  res.json(row?.value ?? null);
});

router.put("/settings/:key", async (req, res) => {
  await db.insert(appSettingsTable).values({ key: req.params.key, value: req.body }).onConflictDoUpdate({ target: appSettingsTable.key, set: { value: req.body } });
  res.json({ ok: true });
});

export default router;
