import { Router } from "express";
import { db, substitutionRequestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { suggestSubstitutions, getGeminiSubstitutionInsight } from "../lib/substitution-engine";

const router = Router();

router.post("/suggest", async (req, res) => {
  try {
    const { formula, inventory, neededTons, orderId, productId, productName } = req.body;

    if (!formula || !inventory || !neededTons || !orderId) {
      res.status(400).json({ error: "Missing required fields: formula, inventory, neededTons, orderId" });
      return;
    }

    const result = suggestSubstitutions(formula, inventory, neededTons, orderId, productId, productName);

    const geminiKey = process.env["GEMINI_API_KEY"];
    if (result.suggestions.length > 0 && geminiKey) {
      for (const suggestion of result.suggestions) {
        const insight = await getGeminiSubstitutionInsight(
          suggestion.originalMaterial,
          suggestion.substituteMaterial,
          suggestion.originalPricePerTon,
          suggestion.substitutePricePerTon,
          geminiKey,
        );
        suggestion.aiRationale = insight.rationale;
        suggestion.confidence = insight.confidence;
      }
    }

    const requestId = `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    if (result.suggestions.length > 0) {
      await db.insert(substitutionRequestsTable).values({
        requestId,
        orderId,
        productId,
        productName,
        originalMaterialName: result.suggestions[0]?.originalMaterial ?? "",
        originalPricePerTon: result.suggestions[0]?.originalPricePerTon?.toString() ?? "0",
        substituteMaterialName: result.suggestions[0]?.substituteMaterial ?? "",
        substitutePricePerTon: result.suggestions[0]?.substitutePricePerTon?.toString() ?? "0",
        substituteAvailableQty: result.suggestions[0]?.substituteAvailableTons?.toString() ?? "0",
        neededTons: neededTons.toString(),
        costImpact: result.totalImpact.toString(),
        newTotalCost: result.totalNewCost.toString(),
        status: "pending",
        aiSuggestion: result.suggestions.map(s => `${s.originalMaterial} → ${s.substituteMaterial}`).join("; "),
      });
    }

    res.json({
      requestId: result.suggestions.length > 0 ? requestId : undefined,
      ...result,
      hasSuggestions: result.suggestions.length > 0,
      message: result.suggestions.length > 0
        ? `تم العثور على ${result.suggestions.length} بديل(ة) مقترح(ة)`
        : "جميع الخامات متوفرة — لا حاجة للاستبدال",
    });
  } catch (err) {
    console.error("Substitution suggestion error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/approve", async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) { res.status(400).json({ error: "Missing requestId" }); return; }
  const [request] = await db.update(substitutionRequestsTable)
    .set({ status: "approved", approvedAt: new Date().toISOString() as any })
    .where(eq(substitutionRequestsTable.requestId, requestId))
    .returning();
  if (!request) { res.status(404).json({ error: "Substitution request not found" }); return; }
  res.json({ message: "تمت الموافقة على الاستبدال بنجاح", requestId, status: "approved" });
});

router.post("/reject", async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) { res.status(400).json({ error: "Missing requestId" }); return; }
  const [request] = await db.update(substitutionRequestsTable)
    .set({ status: "rejected", rejectedAt: new Date().toISOString() as any })
    .where(eq(substitutionRequestsTable.requestId, requestId))
    .returning();
  if (!request) { res.status(404).json({ error: "Substitution request not found" }); return; }
  res.json({ message: "تم رفض الاستبدال", requestId, status: "rejected" });
});

router.get("/pending", async (_req, res) => {
  const pending = await db.select().from(substitutionRequestsTable)
    .where(eq(substitutionRequestsTable.status, "pending"))
    .orderBy(desc(substitutionRequestsTable.createdAt));
  res.json({ pending, count: pending.length });
});

export default router;
