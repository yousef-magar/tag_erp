import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/middleware";

const router = Router();

router.get("/notifications", async (_req, res) => {
  const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt));
  res.json(rows);
});

router.post("/notifications", async (req, res) => {
  const row = await db.insert(notificationsTable).values(req.body).returning();
  res.status(201).json(row[0]);
});

router.put("/notifications/:id/read", async (req, res) => {
  const row = await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, req.params.id)).returning();
  res.json(row[0]);
});

router.put("/notifications/read-all", authMiddleware, async (_req, res) => {
  await db.update(notificationsTable).set({ read: true });
  res.json({ ok: true });
});

router.delete("/notifications", authMiddleware, async (_req, res) => {
  await db.delete(notificationsTable);
  res.json({ ok: true });
});

export default router;
