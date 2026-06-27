/**
 * AI-Powered Substitution Engine
 *
 * Intelligently suggests material substitutions when an ingredient
 * runs out in inventory, calculates cost impact, and manages
 * the approval workflow.
 */

export interface MaterialInfo {
  id: string;
  name: string;
  category: string;
  pricePerTon: number;
  availableTons: number;
  unit: "ton" | "kg";
  substitutionGroup?: string;
}

export interface FormulaIngredient {
  material: string;
  pct: number;
}

export interface SubstitutionSuggestion {
  originalMaterial: string;
  originalPricePerTon: number;
  substituteMaterial: string;
  substitutePricePerTon: number;
  substituteAvailableTons: number;
  neededTons: number;
  costImpact: number;
  newTotalCost: number;
  reason: "out_of_stock" | "insufficient_stock";
  aiRationale: string;
  confidence: number;
}

export interface SubstitutionResult {
  orderId: string;
  productId: string;
  productName: string;
  suggestions: SubstitutionSuggestion[];
  totalOriginalCost: number;
  totalNewCost: number;
  totalImpact: number;
}

/**
 * Material substitution groups — defines which materials can
 * substitute each other based on nutritional/functional properties.
 */
const SUBSTITUTION_GROUPS: Record<string, {
  name: string;
  description: string;
  priority: number; // lower = preferred
}> = {
  "corn":      { name: "ذرة",         description: "Yellow corn varieties",         priority: 1 },
  "soy":       { name: "صويا",        description: "Soybean meal varieties",        priority: 1 },
  "wheat_bran":{ name: "نخالة",       description: "Wheat bran / pollard",          priority: 1 },
  "gluten":    { name: "جلوتين",      description: "Corn gluten meal",              priority: 1 },
  "premix":    { name: "فيتامينات",   description: "Vitamin premixes",             priority: 1 },
};

/**
 * Detect which substitution group a material belongs to.
 */
function detectGroup(materialName: string): string | undefined {
  const name = materialName.toLowerCase();
  if (name.includes("ذرة") || name.includes("corn") || name.includes("ذره")) return "corn";
  if (name.includes("صويا") || name.includes("soy") || name.includes("فول")) return "soy";
  if (name.includes("نخالة") || name.includes("ردة") || name.includes("bran")) return "wheat_bran";
  if (name.includes("جلوتين") || name.includes("gluten")) return "gluten";
  if (name.includes("فيتامين") || name.includes("بريمكس") || name.includes("premix") || name.includes("vitamin")) return "premix";
  return undefined;
}

/**
 * Find the best substitute for a material from available inventory.
 * Uses a combination of group matching, price optimization, and stock availability.
 */
export function findBestSubstitute(
  materialName: string,
  inventory: MaterialInfo[],
  neededTons: number,
  excludeIds: string[] = [],
  originalPricePerTon?: number,
): { substitute: MaterialInfo; rationale: string; confidence: number } | null {
  const group = detectGroup(materialName);
  const groupInfo = group ? SUBSTITUTION_GROUPS[group] : null;

  // Find candidates: same group, has stock, not excluded
  const candidates = inventory.filter(item => {
    if (item.availableTons <= 0) return false;
    if (item.name === materialName) return false;
    if (excludeIds.includes(item.id)) return false;
    if (group) {
      const itemGroup = detectGroup(item.name);
      return itemGroup === group;
    }
    // Fallback: fuzzy match by first word
    const firstWord = materialName.split(/\s+/)[0];
    return item.name.includes(firstWord);
  });

  if (candidates.length === 0) return null;

  // Score candidates: prefer sufficient stock, lower price relative to original, higher confidence
  const scored = candidates.map(c => {
    const hasEnough = c.availableTons >= neededTons;
    const stockScore = hasEnough ? 100 : (c.availableTons / neededTons) * 50;
    const origPrice = originalPricePerTon ?? c.pricePerTon;
    const priceDiff = c.pricePerTon - origPrice;
    const priceScore = Math.max(0, 100 - Math.abs(priceDiff / 10000) * 10);
    const groupScore = groupInfo ? (groupInfo.priority === 1 ? 100 : 50) : 30;
    const totalScore = stockScore * 2 + priceScore + groupScore;

    return { substitute: c, score: totalScore, hasEnough };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  const origPrice = originalPricePerTon ?? best.substitute.pricePerTon;
  const priceDiff = best.substitute.pricePerTon - origPrice;
  const priceWord = priceDiff > 0 ? "أعلى" : "أقل";

  let rationale = "";
  if (group) {
    rationale = `بديل من مجموعة "${groupInfo!.name}" — متوفر ${best.substitute.availableTons.toFixed(0)} طن`;
    if (best.hasEnough) {
      rationale += ` (يكفي الكمية المطلوبة)`;
    }
  } else {
    rationale = `أفضل بديل متاح — مخزون ${best.substitute.availableTons.toFixed(0)} طن`;
  }

  const confidence = Math.round((best.score / 400) * 100);

  return {
    substitute: best.substitute,
    rationale,
    confidence: Math.min(95, Math.max(5, confidence)),
  };
}

/**
 * Generate substitution suggestions for all formula ingredients
 * that have insufficient stock.
 */
export function suggestSubstitutions(
  formula: FormulaIngredient[],
  inventory: MaterialInfo[],
  neededTons: number,
  orderId: string,
  productId: string,
  productName: string,
): SubstitutionResult {
  const suggestions: SubstitutionSuggestion[] = [];
  let totalOriginalCost = 0;
  let totalNewCost = 0;

  for (const ing of formula) {
    const needed = (neededTons * ing.pct) / 100;
    const match = inventory.find(i => i.name === ing.material);
    const currentPrice = match?.pricePerTon ?? 0;
    const available = match?.availableTons ?? 0;

    totalOriginalCost += needed * currentPrice;

    if (available >= needed) {
      totalNewCost += needed * currentPrice;
      continue;
    }

    const found = findBestSubstitute(ing.material, inventory, needed, [match?.id ?? ""], currentPrice);
    if (!found) {
      totalNewCost += needed * currentPrice;
      continue;
    }

    const substAvailable = found.substitute.availableTons;
    if (substAvailable < needed && substAvailable < needed * 0.5) {
      totalNewCost += needed * currentPrice;
      continue;
    }

    const origCost = needed * currentPrice;
    const newCost = needed * found.substitute.pricePerTon;
    const impact = newCost - origCost;

    totalNewCost += newCost;

    suggestions.push({
      originalMaterial: ing.material,
      originalPricePerTon: currentPrice,
      substituteMaterial: found.substitute.name,
      substitutePricePerTon: found.substitute.pricePerTon,
      substituteAvailableTons: found.substitute.availableTons,
      neededTons: needed,
      costImpact: +impact.toFixed(2),
      newTotalCost: +newCost.toFixed(2),
      reason: available <= 0 ? "out_of_stock" : "insufficient_stock",
      aiRationale: found.rationale,
      confidence: found.confidence,
    });
  }

  return {
    orderId,
    productId,
    productName,
    suggestions,
    totalOriginalCost: +totalOriginalCost.toFixed(2),
    totalNewCost: +totalNewCost.toFixed(2),
    totalImpact: +(totalNewCost - totalOriginalCost).toFixed(2),
  };
}

/**
 * Get AI-generated insights for a substitution using Gemini.
 * This is the advanced mode — falls back to the engine if no API key.
 */
export async function getGeminiSubstitutionInsight(
  originalMaterial: string,
  substituteMaterial: string,
  pricePerTon: number,
  substitutePricePerTon: number,
  apiKey?: string,
): Promise<{ rationale: string; confidence: number; warnings: string[] }> {
  if (!apiKey) {
    return {
      rationale: `استبدال ${originalMaterial} بـ ${substituteMaterial} — فرق سعر ${(substitutePricePerTon - pricePerTon).toFixed(0)} ج.م/طن`,
      confidence: 70,
      warnings: [],
    };
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      أنت خبير في مصانع الأعلاف ومشتريات الخامات.
      المادة الأصلية: ${originalMaterial}
      المادة البديلة: ${substituteMaterial}
      سعر المادة الأصلية: ${pricePerTon} ج.م/طن
      سعر المادة البديلة: ${substitutePricePerTon} ج.م/طن

      هل هذا الاستبدال مناسب؟ وضح:
      1. هل هناك أي تحذيرات غذائية أو فنية؟
      2. التأثير على جودة العلف
      3. تقييمك لفرق السعر
      4. توصيتك (موافقة/رفض/موافقة مع تحفظات)

      أجب بصيغة JSON:
      {
        "rationale": "التفسير المفصل",
        "confidence": 85,
        "warnings": ["تحذير 1", "تحذير 2"],
        "recommendation": "approve" | "reject" | "conditional"
      }
    `;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 1024 },
    });

    const text = result.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        rationale: parsed.rationale ?? text.slice(0, 300),
        confidence: parsed.confidence ?? 70,
        warnings: parsed.warnings ?? [],
      };
    }

    return {
      rationale: text.slice(0, 300),
      confidence: 70,
      warnings: [],
    };
  } catch {
    return {
      rationale: `AI غير متاح حالياً. الاستبدال المقترح: ${originalMaterial} ← ${substituteMaterial}`,
      confidence: 50,
      warnings: ["AI temporarily unavailable, using algorithmic suggestion"],
    };
  }
}
