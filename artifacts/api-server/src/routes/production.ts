import { Router } from "express";
import { db, productionOrdersTable, warehouseConfigsTable, workSessionsTable, bagEntriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/production-orders", async (_req, res) => {
  const rows = await db.select().from(productionOrdersTable).orderBy(desc(productionOrdersTable.createdAt));
  res.json(rows);
});

router.post("/production-orders", async (req, res) => {
  const row = await db.insert(productionOrdersTable).values(req.body).returning();
  res.status(201).json(row[0]);
});

router.put("/production-orders/:id", async (req, res) => {
  const row = await db.update(productionOrdersTable).set(req.body).where(eq(productionOrdersTable.id, req.params.id)).returning();
  res.json(row[0]);
});

router.delete("/production-orders/:id", async (req, res) => {
  await db.transaction(async (tx) => {
    await tx.delete(workSessionsTable).where(eq(workSessionsTable.orderId, req.params.id));
    await tx.delete(bagEntriesTable).where(eq(bagEntriesTable.orderId, req.params.id));
    await tx.delete(productionOrdersTable).where(eq(productionOrdersTable.id, req.params.id));
  });
  res.json({ ok: true });
});

router.get("/sessions/:orderId", async (req, res) => {
  const rows = await db.select().from(workSessionsTable).where(eq(workSessionsTable.orderId, req.params.orderId)).orderBy(workSessionsTable.date);
  res.json(rows);
});

router.post("/sessions", async (req, res) => {
  const row = await db.insert(workSessionsTable).values(req.body).returning();
  res.status(201).json(row[0]);
});

router.get("/bag-entries/:orderId", async (req, res) => {
  const rows = await db.select().from(bagEntriesTable).where(eq(bagEntriesTable.orderId, req.params.orderId));
  res.json(rows);
});

router.get("/warehouse-configs", async (_req, res) => {
  const rows = await db.select().from(warehouseConfigsTable);
  res.json(rows);
});

router.post("/warehouse-configs", async (req, res) => {
  const row = await db.insert(warehouseConfigsTable).values(req.body).returning();
  res.status(201).json(row[0]);
});

router.put("/warehouse-configs/:id", async (req, res) => {
  const row = await db.update(warehouseConfigsTable).set(req.body).where(eq(warehouseConfigsTable.id, req.params.id)).returning();
  res.json(row[0]);
});

export default router;
