import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useSalesStore } from "@/hooks/use-sales-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { useFleetStore } from "@/hooks/use-fleet-store";
import { useProcurementStore } from "@/hooks/use-procurement-store";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  FileBarChart,
  PieChart,
  TrendingUp,
  Lightbulb,
  Loader2,
  AlertCircle,
  Bot,
  Settings,
} from "lucide-react";
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GEMINI_KEY_STORAGE = "feedflow-gemini-key";

function getApiKey(): string {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || "";
}

function buildSystemContext(): string {
  try {
    const appState = useAppStore.getState();
    const currentAccount = appState.loggedInSubAccountId
      ? appState.subAccounts.find(a => a.id === appState.loggedInSubAccountId)
      : null;
    const perm = (path: string) => currentAccount?.permissions[path] || "full";
    const hasModule = (path: string) => perm(path) !== "none";
    const isAdmin = !currentAccount;

    const { invoices, customers, returns, payments } = useSalesStore.getState();
    const { inventory, orders: productionOrders } = useProductionStore.getState();
    const { employees } = useHRStore.getState();
    const { vehicles, shipments } = useFleetStore.getState();
    const { suppliers, orders } = useProcurementStore.getState();

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const fmt = (n: number) => n.toLocaleString("ar-EG");

    const parts: string[] = [];
    parts.push(`تاريخ البيانات: ${now.toLocaleDateString("ar-EG")}`);

    // ── Sales ──
    if (hasModule("/sales") || hasModule("/customers") || isAdmin) {
      const totalRev = invoices.reduce((s, i) => s + i.total, 0);
      const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
      const monthInvs = invoices.filter(i => {
        const d = new Date(i.date);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      });
      const monthRev = monthInvs.reduce((s, i) => s + i.total, 0);
      const overdueInvs = invoices.filter(i => i.status === "overdue");
      const overdueAmt = overdueInvs.reduce((s, i) => s + i.total - (i.paidAmount || 0), 0);
      const topCusts = [...customers].sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 5);
      const custDebt = customers.reduce((s, c) => s + (c.outstandingDebt || 0), 0);

      parts.push(`المبيعات: ${invoices.length} فاتورة | الإيرادات: ${fmt(totalRev)} ج.م | المدفوع: ${fmt(totalPaid)} ج.م`);
      parts.push(`مبيعات الشهر الحالي: ${fmt(monthRev)} ج.م`);
      parts.push(`فواتير متأخرة: ${overdueInvs.length} (${fmt(overdueAmt)} ج.م) | ديون العملاء: ${fmt(custDebt)} ج.م`);
      parts.push(`أفضل 5 عملاء: ${topCusts.map((c, i) => `${i + 1}- ${c.name} (مشتريات: ${fmt(c.totalPurchases)} ج.م)`).join("، ")}`);
      if (perm("/customers") !== "none" || isAdmin) {
        parts.push(`العملاء: ${customers.map(c => c.name).join("، ")}`);
      }
    }

    // ── Inventory ──
    if (hasModule("/inventory") || hasModule("/production") || isAdmin) {
      const raw = inventory.filter(i => i.type === "raw");
      const finished = inventory.filter(i => i.type === "finished");
      const critical = inventory.filter(i => i.alertLevel === "critical");
      const warning = inventory.filter(i => i.alertLevel === "warning");
      const rawQty = raw.reduce((s, i) => s + i.quantity, 0);
      const finQty = finished.reduce((s, i) => s + i.quantity, 0);
      parts.push(`المخزون: ${inventory.length} صنف | خام: ${raw.length} (${fmt(rawQty)} طن) | تام: ${finished.length} (${fmt(finQty)} طن)`);
      parts.push(`حرج: ${critical.length} | إنذار: ${warning.length}`);
    }

    // ── Production ──
    if (hasModule("/production") || isAdmin) {
      const activeProd = productionOrders.filter(o => o.status === "in-progress" || o.status === "pending");
      const completedProd = productionOrders.filter(o => o.status === "completed");
      const monthProd = productionOrders.filter(o => {
        const d = new Date(o.date);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      });
      parts.push(`الإنتاج: نشط ${activeProd.length} | مكتمل ${completedProd.length} | هذا الشهر ${monthProd.length} أمر`);
    }

    // ── HR ──
    if ((hasModule("/hr") && !currentAccount?.canAccessHR === false) || isAdmin) {
      const activeEmps = employees.filter(e => e.status === "active");
      const deptMap: Record<string, number> = {};
      activeEmps.forEach(e => { deptMap[e.department] = (deptMap[e.department] || 0) + 1; });
      parts.push(`الموظفون: ${employees.length} | نشط: ${activeEmps.length}`);
      parts.push(Object.entries(deptMap).map(([d, n]) => `${d}: ${n}`).join(" | "));
      if (hasModule("/payroll") && !currentAccount?.canAccessPayroll === false || isAdmin) {
        const totalSalary = activeEmps.reduce((s, e) => s + e.baseSalary + (e.allowances || 0), 0);
        parts.push(`إجمالي الرواتب: ${fmt(totalSalary)} ج.م`);
      }
    }

    // ── Fleet ──
    if (hasModule("/fleet") || isAdmin) {
      const availVeh = vehicles.filter(v => v.status === "available");
      const onRoute = vehicles.filter(v => v.status === "on-route");
      const monthTrips = shipments.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      }).length;
      parts.push(`الأسطول: متاح ${availVeh.length} | في الطريق ${onRoute.length} | ${monthTrips} رحلة هذا الشهر`);
    }

    // ── Procurement ──
    if (hasModule("/procurement") || isAdmin) {
      const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "approved");
      const totalPurch = orders.reduce((s, o) => s + o.total, 0);
      const topSupps = [...suppliers].sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 3);
      parts.push(`المشتريات: معلق ${pendingOrders.length} | الإجمالي ${fmt(totalPurch)} ج.م`);
      parts.push(`الموردون: ${topSupps.map(s => `${s.name} (${fmt(s.totalPurchases)} ج.م)`).join("، ")}`);
    }

    const userDesc = isAdmin ? "مدير النظام" : `"${currentAccount!.name}" (${currentAccount!.role})`;
    const restrictionNote = !isAdmin
      ? `\n\nملاحظة: المستخدم ${userDesc} ليس لديه صلاحية على كل الأقسام. إذا سأل عن قسم خارج صلاحياته، أخبره بأنه لا يملك صلاحية للاطلاع على هذه البيانات.`
      : "";

    return parts.join("\n") + restrictionNote;
  } catch {
    return "أنت مساعد ذكي لنظام تاج. أجب باللغة العربية.";
  }
}

async function callGemini(messages: Message[], userMessage: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("لم يتم العثور على مفتاح API");

  const dataContext = buildSystemContext();
  const appState = useAppStore.getState();
  const currentUser = appState.loggedInSubAccountId
    ? appState.subAccounts.find(a => a.id === appState.loggedInSubAccountId)
    : null;
  const userIdentity = currentUser
    ? `المستخدم الحالي: "${currentUser.name}" - الوظيفة: ${currentUser.role}`
    : "المستخدم الحالي: مدير النظام (صلاحية كاملة)";
  const history = messages.slice(1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const models = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastErr: string | null = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `[بيانات النظام الحالية]\n${dataContext}\n\n${userIdentity}\n\nأنت مساعد ذكي لمصنع أعلاف. أجب بالعربية بناءً على البيانات أعلاه فقط. لا تقل أنك لا تستطيع الوصول للبيانات. إذا سأل المستخدم عن قسم ليس لديه صلاحية عليه، أخبره بأدب أنه لا يملك صلاحية الاطلاع.` }],
            },
            {
              role: "model",
              parts: [{ text: "تمام. أنا جاهز. سأرد بناءً على بيانات النظام مع مراعاة صلاحيات المستخدم." }],
            },
            ...history,
            { role: "user", parts: [{ text: userMessage }] },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      });
      if (res.status === 403 || res.status === 400) {
        const errText = await res.text().catch(() => "");
        lastErr = errText;
        continue;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastErr = errText;
        continue;
      }
      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch {
      continue;
    }
  }

  throw new Error(`فشل الاتصال ب Gemini: ${(lastErr || "غير معروف").slice(0, 300)}`);
}

const INSIGHTS = [
  {
    icon: TrendingUp,
    color: "text-primary",
    borderHover: "hover:border-primary/40",
    titleAr: "توقع الطلب",
    titleEn: "Demand Forecast",
    descAr: "من المتوقع زيادة الطلب على علف تسمين العجول بنسبة 15% الأسبوع القادم.",
    descEn: "Calf fattening feed demand expected to rise 15% next week.",
    qAr: "أخبرني المزيد عن توقع الطلب",
    qEn: "Tell me more about demand forecast",
  },
  {
    icon: FileBarChart,
    color: "text-chart-2",
    borderHover: "hover:border-chart-2/40",
    titleAr: "تحليل التكلفة",
    titleEn: "Cost Analysis",
    descAr: "تكلفة إنتاج طن نامي 21% انخفضت 2% بسبب نزول سعر الصويا.",
    descEn: "Nami 21% production cost dropped 2% due to soy price decrease.",
    qAr: "حلّل تكاليف الإنتاج الشهر الحالي",
    qEn: "Analyze this month's production costs",
  },
  {
    icon: PieChart,
    color: "text-chart-4",
    borderHover: "hover:border-chart-4/40",
    titleAr: "سلوك العملاء",
    titleEn: "Customer Behavior",
    descAr: "مزارع الوطنية تأخرت عن موعد طلبها المعتاد بـ 3 أيام.",
    descEn: "Al-Watania Farms is 3 days late for their usual order.",
    qAr: "ما أفضل عملائي من حيث الالتزام؟",
    qEn: "Who are my most reliable customers?",
  },
];

export default function AiAssistant() {
  const { t } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t(
        "مرحباً! أنا مساعدك الذكي لـ تاج. يمكنني مساعدتك في تحليل بيانات المصنع، المبيعات، المخزون، والإنتاج. كيف يمكنني مساعدتك اليوم؟",
        "Hello! I'm your تاج AI Assistant. I can help you analyze factory data, sales, inventory, and production. How can I help you today?"
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const chips = [
    t("كم مبيعات الشهر؟", "Monthly sales?"),
    t("المخزون الحرج", "Critical inventory"),
    t("أفضل عميل", "Top customer"),
    t("توقع الشهر القادم", "Next month forecast"),
  ];



  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await callGemini(messages, trimmed);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("حدث خطأ أثناء الاتصال. تحقق من المفتاح أو الاتصال.", "Connection error. Check API key or network."));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 112px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-chart-4 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">{t("المساعد الذكي", "AI Assistant")}</h1>
          <p className="text-muted-foreground text-xs">{t("مدعوم بـ Gemini AI", "Powered by Gemini AI")}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-4 min-h-0">

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-primary/20 bg-card shadow-sm overflow-hidden">
          {/* Top bar gradient */}
          <div className="h-0.5 bg-gradient-to-r from-primary via-chart-4 to-primary shrink-0" />

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 flex flex-col gap-3 custom-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold ${
                      msg.role === "assistant"
                        ? "bg-gradient-to-tr from-primary to-chart-4 text-primary-foreground"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {msg.role === "assistant" ? <Bot className="w-3.5 h-3.5" /> : "أنت"}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "assistant"
                        ? "bg-muted/60 rounded-ss-none"
                        : "bg-primary text-primary-foreground rounded-se-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading bubble */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary to-chart-4 flex items-center justify-center text-primary-foreground shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-muted/60 rounded-2xl rounded-ss-none px-4 py-2.5 flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur-sm p-2 sm:p-3">
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {chips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(chip)}
                  disabled={loading}
                  className="text-xs text-muted-foreground bg-muted hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1 rounded-full border border-border transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                disabled={loading}
                placeholder={t("اسأل المساعد الذكي...", "Ask the AI assistant...")}
                className="flex-1 h-9 px-3 rounded-lg bg-muted/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm transition-colors disabled:opacity-50"
              />
              <Button
                size="icon"
                disabled={!input.trim() || loading}
                onClick={() => sendMessage(input)}
                className="h-9 w-9 shrink-0 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 rtl:-scale-x-100" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Insights Sidebar */}
        <div className="w-full sm:w-64 shrink-0 flex flex-col gap-3 min-h-0">
          <div className="rounded-xl border border-border bg-card shadow-sm p-3 sm:p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 shrink-0">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-sm">{t("رؤى ذكية", "Smart Insights")}</span>
            </div>

            {INSIGHTS.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  onClick={() => sendMessage(t(item.qAr, item.qEn))}
                  disabled={loading}
                  className={`w-full text-start p-3 rounded-lg bg-background border border-border hover:shadow-sm ${item.borderHover} transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <div className={`flex items-center gap-1.5 mb-1 ${item.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="font-semibold text-xs">{t(item.titleAr, item.titleEn)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(item.descAr, item.descEn)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
