import { FEED_TERMS, EGYPTIAN_CORRECTIONS, getBetterName as dictGetBetterName } from "./arabic-dict";

const AR_COMMON_WORDS = new Set([
  "السلام", "عليكم", "مرحبا", "شكرا", "جزيلا", "منتجات", "أعلاف", "مصنع",
  "feedflow", "feed", "flow", "erp", "نظام", "محاسبة", "مخزون", "مبيعات",
  "مشتريات", "إنتاج", "تسعير", "تكلفة", "عميل", "مورد", "موظف", "فاتورة",
  "حساب", "بنك", "محفظة", "تقارير", "إعدادات", "صلاحيات", "دخول", "خروج",
  "تصنيع", "خامات", "مواد", "وزن", "طن", "كيلو", "سعر", "ربح", "خسارة",
  "هامش", "ضريبة", "خصم", "إجمالي", "صافي", "مدين", "دائن", "نقدي", "أجل",
  "شيك", "تحويل", "إيداع", "سحب", "رصيد", "كشف", "حسابات", "فرعية",
  "الرئيسية", "لوحة", "القيادة", "أسطول", "نقل", "سائق", "مركبة", "شحنة",
  "توصيل", "عنوان", "منطقة", "محافظة", "الموارد", "البشرية", "دوام",
  "وردية", "راتب", "عمولة", "حافز", "غياب", "حضور", "إجازة", "أمر", "إنتاج",
  "خلطة", "تركيبة", "بديل", "موافقة", "مستودع", "تنبيه", "إنذار",
  "البحث", "سجل", "النشاط", "طباعة", "تصدير", "استيراد", "نسخ", "احتياطي",
  "استعادة", "حذف", "إضافة", "تعديل", "عرض", "تحديث", "حفظ", "إلغاء",
  // Feed terms
  ...Object.keys(FEED_TERMS), ...Object.values(FEED_TERMS),
]);

const EN_COMMON_WORDS = new Set([
  "feedflow", "erp", "dashboard", "production", "inventory", "sales",
  "procurement", "pricing", "cost", "customer", "supplier", "employee",
  "invoice", "account", "bank", "wallet", "report", "setting", "permission",
  "login", "logout", "manufacturing", "raw", "material", "weight", "ton",
  "kg", "price", "profit", "loss", "margin", "tax", "discount", "total",
  "net", "debit", "credit", "cash", "credit", "check", "transfer",
  "deposit", "withdraw", "balance", "statement", "sub", "account",
  "fleet", "vehicle", "driver", "shipment", "delivery", "address",
  "region", "governorate", "human", "resource", "hr", "shift", "salary",
  "commission", "incentive", "absent", "present", "leave", "order",
  "formula", "recipe", "substitute", "approval", "warehouse", "alert",
  "search", "activity", "log", "print", "export", "import", "backup",
  "restore", "delete", "add", "edit", "view", "update", "save", "cancel",
  "analytics", "chart", "graph", "report", "kpi", "metric", "overview",
]);

const AR_ALL_TERMS = [...AR_COMMON_WORDS, ...Object.keys(FEED_TERMS), ...Object.values(FEED_TERMS)];

export function suggestSpelling(text: string, lang: "ar" | "en"): string[] {
  const words = text.split(/\s+/);
  const suggestions: string[] = [];
  for (const word of words) {
    const dict = lang === "ar" ? new Set(AR_ALL_TERMS) : EN_COMMON_WORDS;
    if (word.length < 3 || dict.has(word.toLowerCase())) continue;
    for (const dictWord of dict) {
      const dist = levenshtein(word.toLowerCase(), dictWord.toLowerCase());
      if (dist <= 2 && dist > 0) {
        suggestions.push(`${word} ← ${dictWord}`);
        break;
      }
    }
  }
  return suggestions;
}

export function autoCorrect(text: string): string {
  let result = text;
  // Egyptian dialect corrections
  for (const [wrong, correct] of Object.entries(EGYPTIAN_CORRECTIONS)) {
    result = result.replace(new RegExp(wrong, "g"), correct);
  }
  // Feed terms full match
  const trimmed = result.trim().toLowerCase();
  for (const [key, value] of Object.entries(FEED_TERMS)) {
    if (trimmed === key.toLowerCase()) {
      return value;
    }
  }
  // Fuzzy match for feed terms
  for (const [key, value] of Object.entries(FEED_TERMS)) {
    if (levenshtein(trimmed, key.toLowerCase()) <= 2) {
      return value;
    }
  }
  return result;
}

export function getCompletions(partial: string, extraSources: string[] = []): string[] {
  if (!partial.trim()) return [];
  const lower = partial.trim().toLowerCase();
  const sources = new Set(extraSources);
  return [...sources].filter(s => s.toLowerCase().includes(lower)).slice(0, 10);
}

export function getBetterName(name: string): string | null {
  return dictGetBetterName(name);
}

export function getFeedTermSuggestions(): string[] {
  return [...Object.keys(FEED_TERMS), ...Object.values(FEED_TERMS)];
}

export function suggestCorrection(value: string, extraSuggestions: string[]): string | null {
  if (!value.trim() || extraSuggestions.length === 0) return null;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (extraSuggestions.some(s => s.toLowerCase() === lower)) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const suggestion of extraSuggestions) {
    const dist = levenshtein(lower, suggestion.toLowerCase());
    if (dist <= 2 && dist > 0 && dist < bestDist) {
      best = suggestion;
      bestDist = dist;
    }
  }
  return best;
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }
  return dp[m][n];
}
