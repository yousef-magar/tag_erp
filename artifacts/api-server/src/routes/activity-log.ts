import { Router } from "express";
import { db, activityEntriesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/middleware";

const router = Router();

router.get("/activity-log", async (req, res) => {
  const { module, from, to, query } = req.query;
  let where = sql`1=1`;
  if (module) where = sql`${where} AND module = ${module as string}`;
  if (from) where = sql`${where} AND timestamp >= ${from as string}`;
  if (to) where = sql`${where} AND timestamp <= ${to as string}`;
  if (query) where = sql`${where} AND (ar_description ILIKE ${'%' + query + '%'} OR en_description ILIKE ${'%' + query + '%'})`;
  const rows = await db.select().from(activityEntriesTable).where(where).orderBy(desc(activityEntriesTable.timestamp));
  res.json(rows);
});

router.post("/activity-log", async (req, res) => {
  const row = await db.insert(activityEntriesTable).values(req.body).returning();
  res.status(201).json(row[0]);
});

router.delete("/activity-log", authMiddleware, async (_req, res) => {
  await db.delete(activityEntriesTable);
  res.json({ ok: true });
});

export default router;
