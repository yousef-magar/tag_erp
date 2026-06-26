import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useSalesStore } from "@/hooks/use-sales-store";
import { useFleetStore } from "@/hooks/use-fleet-store";
import { usePricingStore } from "@/hooks/use-pricing-store";
import { useProcurementStore } from "@/hooks/use-procurement-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  TrendingUp, DollarSign, Package, AlertTriangle, Users, Truck,
  ArrowUpRight, ArrowDownRight, Factory, FileText, Download,
  CheckCircle2, PlayCircle, PauseCircle, Clock, PackageCheck,
  ShoppingCart, UserCheck, UserX, CreditCard, BarChart3, MapPin,
  Percent, Shield, RefreshCw, Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { TiltCard, TiltCardContent } from "@/components/ui/TiltCard";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { TextReveal } from "@/components/ui/TextReveal";
import { RippleEffect } from "@/components/ui/RippleEffect";
import { useParticleField } from "@/components/ui/ParticleField";

const WEEKDAY_NAMES = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

function fmtTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return new Date(dateStr).toLocaleDateString("ar-EG");
}

function AnimatedNumber({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const step = Math.max(1, Math.ceil(target / 60));
    const interval = duration / (target / step);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setDisplay(target); clearInterval(timer); }
      else setDisplay(start);
    }, interval);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{display}</span>;
}

const nowDate = () => new Date().toISOString().split("T")[0];

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat("ar-EG").format(n);
}

export default function Dashboard() {
  const { t, language } = useAppStore();
  const { orders, inventory } = useProductionStore();
  const { invoices } = useSalesStore();
  const { shipments, vehicles } = useFleetStore();
  const { productPrices, pricingAlerts } = usePricingStore();
  const { orders: procOrders } = useProcurementStore();
  const { employees } = useHRStore();
  const { overdueAlerts } = useAppStore();

  const todayDate = nowDate();
  const liveRef = useRef<HTMLDivElement>(null);
  const { ref: particleRef, burst } = useParticleField();

  // ── Production ──
  const activeOrders = useMemo(() => orders.filter(o => o.status === "in-progress"), [orders]);
  const pausedOrders = useMemo(() => orders.filter(o => o.status === "paused"), [orders]);
  const todayCompleted = useMemo(() => orders.filter(o => o.status === "completed" && o.date === todayDate), [orders, todayDate]);
  const todayProducedT = useMemo(() => todayCompleted.reduce((s, o) => s + (o.producedTons || 0), 0), [todayCompleted]);
  const totalFinished = useMemo(() => inventory.filter(i => i.type === "finished").reduce((s, i) => s + (i.unit === "ton" ? i.quantity : i.quantity / 1000), 0), [inventory]);
  const criticalItems = useMemo(() => inventory.filter(i => i.alertLevel === "critical").length, [inventory]);
  const warningItems = useMemo(() => inventory.filter(i => i.alertLevel === "warning").length, [inventory]);

  // ── Sales ──
  const todayInvoices = useMemo(() => invoices.filter(i => i.date === todayDate && i.status !== "pending"), [invoices, todayDate]);
  const todaySales = useMemo(() => todayInvoices.reduce((s, i) => s + i.total, 0), [todayInvoices]);
  const todayProfit = useMemo(() => todayInvoices.reduce((sum, inv) => sum + inv.items.reduce((s, item) => {
    const price = productPrices.find(p => p.productId === item.productId);
    const cost = price?.costPrice || 0;
    return s + (item.pricePerTon - cost) * item.qtyTons;
  }, 0), 0), [todayInvoices, productPrices]);

  // ── Fleet ──
  const activeShipments = useMemo(() => shipments.filter(s => s.status === "on-route" || s.status === "loaded").length, [shipments]);
  const availableVehicles = useMemo(() => vehicles.filter(v => v.status === "available").length, [vehicles]);

  // ── HR ──
  const totalEmployees = employees.length;
  const absentToday = employees.filter(e => e.status === "absent").length;
  const presentToday = employees.filter(e => e.status === "present").length;

  // ── App / Financial ──
  const totalOverdue = overdueAlerts.reduce((s, a) => s + a.total, 0);
  const overdueCount = overdueAlerts.length;

  // ── Procurement ──
  const pendingProc = procOrders.filter(o => o.status === "pending" || o.status === "approved").length;
  const procTotalPending = procOrders.filter(o => o.status === "pending" || o.status === "approved").reduce((s, o) => s + o.total, 0);

  // ── Pricing ──
  const alertCount = pricingAlerts.length;

  // ── Charts ──
  const salesData = useMemo(() =>
    WEEKDAY_NAMES.map((name, idx) => {
      const dayInvoices = invoices.filter(i => {
        const d = new Date(i.date);
        return d.getDay() === idx && i.status !== "pending";
      });
      return { name, value: dayInvoices.reduce((s, i) => s + i.total, 0) };
    }), [invoices]);

  const productData = useMemo(() =>
    Object.entries(orders.filter(o => o.status === "completed").reduce((acc, o) => {
      acc[o.productName] = (acc[o.productName] || 0) + (o.producedTons || 0);
      return acc;
    }, {} as Record<string, number>)).map(([name, tons]) => ({ name, sales: Math.round(tons), profit: Math.round(tons * 0.25) })), [orders]);

  // ── Activity ──
  const recentActivity = useMemo(() => {
    const all = [
      ...orders.map(o => ({ id: `prd-${o.id}`, type: "production" as const, action: `${t("أمر", "Order")} ${o.id}: ${o.productName} — ${o.status === "completed" ? t("مكتمل", "Done") : o.status === "in-progress" ? t("يعمل", "Running") : t("موقوف", "Paused")}`, time: o.date || todayDate })),
      ...invoices.map(i => ({ id: `inv-${i.id}`, type: "sales" as const, action: `${t("فاتورة", "Invoice")} ${i.id}: ${i.customerName} — ${i.total.toLocaleString("ar-EG")} ${t("ج.م", "EGP")}`, time: i.date })),
      ...shipments.map(s => ({ id: `shp-${s.id}`, type: "fleet" as const, action: `${t("شحنة", "Shipment")} ${s.id}: ${s.vehicleName} — ${s.totalWeight}${t("ط", "T")}`, time: s.date })),
      ...procOrders.map(o => ({ id: `poc-${o.id}`, type: "inventory" as const, action: `${t("مشتريات", "Purchase")} ${o.id}: ${o.supplierName}`, time: o.date })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
    return all.map(a => ({ ...a, time: fmtTimeAgo(a.time) }));
  }, [orders, invoices, shipments, procOrders, todayDate, t]);

  useEffect(() => {
    const el = liveRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelectorAll(".live-bar"), { scaleX: 0 }, { scaleX: 1, duration: 0.8, stagger: 0.08, ease: "power4.out", transformOrigin: "right center" });
    });
    return () => ctx.revert();
  }, [activeOrders]);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportPeriod, setReportPeriod] = useState("");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = () => {
    if (!reportType || !reportPeriod) return;
    setGenerating(true);
    burst(200, 150);
    setTimeout(() => { setGenerating(false); setReportGenerated(true); }, 1800);
  };

  const reportTitleMap: Record<string, string> = {
    sales: t("تقرير المبيعات", "Sales Report"),
    production: t("تقرير الإنتاج", "Production Report"),
    profit: t("تقرير الأرباح", "Profit Report"),
    inventory: t("تقرير المخزون", "Inventory Report"),
    hr: t("تقرير الموارد البشرية", "HR Report"),
    executive: t("ملخص تنفيذي", "Executive Summary"),
  };

  const periodTitleMap: Record<string, string> = {
    today: t("اليوم", "Today"),
    week: t("الأسبوع الحالي", "This Week"),
    month: t("الشهر الحالي", "This Month"),
    quarter: t("الربع الحالي", "This Quarter"),
    year: t("السنة الحالية", "This Year"),
  };

  const handleDownloadPDF = () => {
    const reportName = reportTitleMap[reportType] || reportType;
    const periodName = periodTitleMap[reportPeriod] || reportPeriod;
    const todayStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const styles = `
      @page { size: A4; margin: 20mm; }
      body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #1a1a1a; line-height: 1.6; }
      .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
      .header h1 { font-size: 24px; margin: 0 0 5px; color: #2563eb; }
      .header p { font-size: 14px; color: #666; margin: 0; }
      .meta { display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 25px; }
      .section { margin-bottom: 20px; }
      .section h2 { font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 8px; color: #2563eb; }
      .section p { font-size: 13px; margin: 5px 0; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
      th { background: #f0f4ff; font-weight: 600; }
      .footer { text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; margin-top: 30px; }
      .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
      .badge-green { background: #dcfce7; color: #16a34a; }
      .badge-blue { background: #dbeafe; color: #2563eb; }
      .badge-red { background: #fee2e2; color: #dc2626; }
    `;

    const t = (ar: string, en: string) => language === "ar" ? ar : en;

    const content = `
      <div class="header">
        <h1>${reportName}</h1>
        <p>${t("فترة التقرير", "Report Period")}: ${periodName}</p>
      </div>
      <div class="meta">
        <span>${t("تاريخ الإنشاء", "Generated")}: ${todayStr}</span>
        <span>تاج</span>
      </div>
      <div class="section">
        <h2>${t("المؤشرات الرئيسية", "Key Metrics")}</h2>
        <p><strong>${t("مبيعات اليوم", "Today's Sales")}:</strong> ${fmtCurrency(todaySales)}</p>
        <p><strong>${t("أرباح اليوم", "Today's Profit")}:</strong> ${fmtCurrency(todayProfit)}</p>
        <p><strong>${t("شحنات نشطة", "Active Shipments")}:</strong> ${activeShipments}</p>
        <p><strong>${t("نواقص حرجة", "Critical Items")}:</strong> ${criticalItems}</p>
      </div>
      <div class="section">
        <h2>${t("الإنتاج", "Production")}</h2>
        <p><strong>${t("أوامر نشطة", "Active Orders")}:</strong> ${activeOrders.length}</p>
        <p><strong>${t("مكتمل اليوم", "Completed Today")}:</strong> ${todayCompleted.length}</p>
        <p><strong>${t("أطنان اليوم", "Tons Today")}:</strong> ${todayProducedT} ${t("ط", "T")}</p>
      </div>
      <div class="section">
        <h2>${t("الموظفين", "Employees")}</h2>
        <p><strong>${t("إجمالي", "Total")}:</strong> ${totalEmployees}</p>
        <p><strong>${t("موجودون", "Present")}:</strong> ${presentToday}</p>
        <p><strong>${t("غائبون", "Absent")}:</strong> ${absentToday}</p>
      </div>
      <div class="section">
        <h2>${t("المالية", "Financial")}</h2>
        <p><strong>${t("قيمة المشتريات المعلقة", "Pending Procurement Value")}:</strong> ${fmtCurrency(procTotalPending)}</p>
        <p><strong>${t("إجمالي المتأخرات", "Total Overdue")}:</strong> ${fmtCurrency(totalOverdue)}</p>
      </div>
      ${salesData.some(d => d.value > 0) ? `
      <div class="section">
        <h2>${t("المبيعات اليومية", "Daily Sales")}</h2>
        <table>
          <tr><th>${t("اليوم", "Day")}</th><th>${t("القيمة", "Value")}</th></tr>
          ${salesData.map(d => `<tr><td>${d.name}</td><td>${fmtCurrency(d.value)}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      ${productData.length > 0 ? `
      <div class="section">
        <h2>${t("أداء المنتجات", "Product Performance")}</h2>
        <table>
          <tr><th>${t("المنتج", "Product")}</th><th>${t("الكمية", "Quantity")} (${t("ط", "T")})</th></tr>
          ${productData.map(d => `<tr><td>${d.name}</td><td>${d.sales}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      <div class="footer">
        <p>${t("تم إنشاؤه بواسطة", "Generated by")} تاج — ${todayStr}</p>
      </div>
    `;

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${reportName}</title><style>${styles}</style></head><body>${content}</body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-5 md:space-y-6 relative p-3 sm:p-6" ref={particleRef}>
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <TextReveal text={t("لوحة القيادة", "Executive Dashboard")} className="text-2xl sm:text-3xl font-bold tracking-tight" as="h1" direction="words" />
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{t("نظرة عامة على أداء المصنع اليوم", "Overview of factory performance today")} — {new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* ═══ KPI ROW ═══ */}
      <ScrollReveal stagger={0.06}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard title={t("مبيعات اليوم", "Today's Sales")} value={fmtCurrency(todaySales)} icon={TrendingUp} />
          <KpiCard title={t("أرباح اليوم", "Today's Profit")} value={fmtCurrency(todayProfit)} icon={DollarSign} />
          <KpiCard title={t("شحنات نشطة", "Active Shipments")} value={String(activeShipments)} icon={Truck} sub={availableVehicles > 0 ? `${availableVehicles} ${t("مركبة جاهزة", "vehicles ready")}` : undefined} />
          <KpiCard title={t("نواقص حرجة", "Critical Inventory")} value={String(criticalItems)} icon={AlertTriangle} alert={criticalItems > 0} sub={warningItems > 0 ? `${warningItems} ${t("تحذير", "warnings")}` : undefined} />
        </div>
      </ScrollReveal>

      {/* ═══ SECONDARY KPI ROW ═══ */}
      <ScrollReveal stagger={0.05} delay={0.1}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <MiniKpi icon={<UserCheck className="w-3.5 h-3.5" />} label={t("موظفين اليوم", "Today Present")} value={String(presentToday)} color="text-emerald-500" bg="bg-emerald-500/10" sub={t("موجود", "present")} />
          <MiniKpi icon={<UserX className="w-3.5 h-3.5" />} label={t("غياب", "Absent")} value={String(absentToday)} color="text-rose-500" bg="bg-rose-500/10" sub={absentToday > 0 ? t("بحاجة للتسجيل", "needs logging") : t("كلهم موجودين", "all present")} />
          <MiniKpi icon={<AlertTriangle className="w-3.5 h-3.5" />} label={t("إنذارات متأخرة", "Overdue Alerts")} value={String(overdueCount)} color="text-orange-500" bg="bg-orange-500/10" sub={overdueCount > 0 ? fmtCurrency(totalOverdue) : t("لا يوجد", "none")} />
          <MiniKpi icon={<Bell className="w-3.5 h-3.5" />} label={t("تنبيهات تسعير", "Pricing Alerts")} value={String(alertCount)} color="text-violet-500" bg="bg-violet-500/10" sub={alertCount > 0 ? t("تحتاج مراجعة", "needs review") : t("لا يوجد", "none")} />
        </div>
      </ScrollReveal>

      {/* ═══ LIVE PRODUCTION STATUS ═══ */}
      <ScrollReveal direction="up" delay={0.15}>
        <TiltCard intensity={5}>
          <Card className="p-4 sm:p-5 bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/15 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
            <TiltCardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <motion.div
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"
                  >
                    <Factory className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm">{t("حالة الإنتاج المباشر", "Live Production Status")}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{t("متزامن مع قسم الإنتاج", "Synced with Production module")}</p>
                  </div>
                </div>
                {activeOrders.length > 0 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2 sm:px-2.5 py-1 rounded-full w-fit"
                  >
                    <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {activeOrders.length} {t("جاري الآن", "running")}
                  </motion.span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <ProdKpi icon={<PlayCircle className="w-3 sm:w-3.5 h-3 sm:h-3.5" />} label={t("يعمل الآن", "Running")} value={activeOrders.length} color="text-primary" bg="bg-primary/8" />
                <ProdKpi icon={<PauseCircle className="w-3 sm:w-3.5 h-3 sm:h-3.5" />} label={t("موقوف", "Paused")} value={pausedOrders.length} color="text-orange-500" bg="bg-orange-500/10" />
                <ProdKpi icon={<CheckCircle2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />} label={t("مكتمل اليوم", "Done Today")} value={todayCompleted.length} color="text-emerald-500" bg="bg-emerald-500/10" />
                <ProdKpi icon={<PackageCheck className="w-3 sm:w-3.5 h-3 sm:h-3.5" />} label={t("أطنان اليوم", "Tons Today")} value={todayProducedT} suffix=" T" color="text-primary" bg="bg-primary/8" />
              </div>

              {activeOrders.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.4 }} className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50 space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground">{t("أوامر تعمل الآن:", "Currently running:")}</p>
                  {activeOrders.slice(0, 4).map((o, i) => (
                    <motion.div key={o.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                      className="flex flex-col xs:flex-row xs:items-center justify-between rounded-lg bg-background/60 border border-border/60 px-3 py-2 gap-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }} className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span className="text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-[200px]">{o.productName}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-mono hidden sm:inline">{o.id}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-[10px] sm:text-xs font-semibold text-primary whitespace-nowrap">{o.producedTons}/{o.targetTons} {t("ط", "T")}</span>
                        <div className="w-12 sm:w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (o.producedTons / o.targetTons) * 100)}%` }}
                            transition={{ duration: 1, delay: 0.5, ease: "power4.out" as any }} className="h-full bg-primary rounded-full live-bar" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground">{t("المخزون — خامات", "Raw Materials")}</p>
                  {totalFinished > 0 && <span className="text-[10px] sm:text-xs text-emerald-600 font-medium">{totalFinished.toFixed(0)} {t("ط منتجات", "T finished")}</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {inventory.filter(i => i.type === "raw").slice(0, 6).map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                      className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border text-[10px] sm:text-xs ${item.alertLevel === "critical" ? "bg-destructive/8 border-destructive/20" : item.alertLevel === "warning" ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/30 border-border/60"}`}>
                      <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1">
                        <span className="font-medium truncate max-w-[60px] sm:max-w-[90px]">{item.materialName}</span>
                        <span className={`font-bold shrink-0 ${item.alertLevel === "critical" ? "text-destructive" : item.alertLevel === "warning" ? "text-amber-500" : "text-emerald-500"}`}>{item.quantity}{item.unit === "ton" ? t("ط", "T") : t("ك", "kg")}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: item.initialQuantity > 0 ? `${(item.quantity / item.initialQuantity) * 100}%` : "0%" }}
                          transition={{ duration: 0.8, delay: 0.5 + i * 0.06, ease: "power4.out" as any }}
                          className={`h-full rounded-full ${item.alertLevel === "critical" ? "bg-destructive" : item.alertLevel === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </TiltCardContent>
          </Card>
        </TiltCard>
      </ScrollReveal>

      {/* ═══ CHARTS ROW ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 md:gap-6">
        <div className="lg:col-span-2 space-y-3 sm:space-y-5 md:space-y-6">
          <ScrollReveal direction="up" delay={0.2}>
            <TiltCard intensity={4}>
              <Card className="p-4 sm:p-6 overflow-hidden relative">
                <TiltCardContent>
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-sm sm:text-lg font-semibold">{t("تحليل المبيعات الأسبوعي", "Weekly Sales Trend")}</h3>
                    <Badge variant="outline" className="text-[9px] sm:text-xs">{t("آخر 7 أيام", "Last 7 days")}</Badge>
                  </div>
                  <div className="h-[220px] sm:h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesData}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v / 1000}k`} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} itemStyle={{ color: "hsl(var(--foreground))" }} formatter={(value: number) => fmtCurrency(value)} />
                        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TiltCardContent>
              </Card>
            </TiltCard>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.3}>
            <TiltCard intensity={4}>
              <Card className="p-4 sm:p-6 overflow-hidden relative">
                <TiltCardContent>
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-sm sm:text-lg font-semibold">{t("أداء المنتجات", "Product Performance")}</h3>
                    <Badge variant="outline" className="text-[9px] sm:text-xs">{t("بالطن", "In tons")}</Badge>
                  </div>
                  <div className="h-[200px] sm:h-[240px] w-full">
                    {productData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productData} layout="vertical" margin={{ left: 20, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={80} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} cursor={{ fill: "hsl(var(--muted)/0.5)" }} />
                          <Bar dataKey="sales" name={t("أطنان", "Tons")} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t("لا توجد بيانات إنتاج مكتملة", "No completed production data")}</div>
                    )}
                  </div>
                </TiltCardContent>
              </Card>
            </TiltCard>
          </ScrollReveal>
        </div>

        <div className="space-y-3 sm:space-y-5 md:space-y-6">
          {/* ── FLEET STATUS ── */}
          <ScrollReveal direction="right" delay={0.25}>
            <TiltCard intensity={4}>
              <Card className="p-4 sm:p-5 overflow-hidden relative h-full">
                <TiltCardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm sm:text-base font-semibold">{t("حالة الأسطول", "Fleet Status")}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
                    {["available", "loading", "on-route", "delivered"].map(st => {
                      const count = vehicles.filter(v => v.status === st).length;
                      const colors: Record<string, string> = { available: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", loading: "bg-amber-500/10 text-amber-500 border-amber-500/20", "on-route": "bg-blue-500/10 text-blue-500 border-blue-500/20", delivered: "bg-muted/30 text-muted-foreground border-border/40" };
                      return count > 0 ? (
                        <span key={st} className={`text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded-full border ${colors[st]}`}>
                          {count} {t(st === "available" ? "جاهزة" : st === "loading" ? "تحميل" : st === "on-route" ? "بالطريق" : "تم", st)}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    {vehicles.slice(0, 3).map((v, i) => (
                      <motion.div key={v.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                        className="flex items-center justify-between rounded-lg bg-muted/30 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs">
                        <span className="font-medium truncate max-w-[100px] sm:max-w-[160px]">{v.name}</span>
                        <span className={`shrink-0 ${v.status === "available" ? "text-emerald-500" : v.status === "on-route" ? "text-blue-500" : v.status === "loading" ? "text-amber-500" : "text-muted-foreground"}`}>
                          {t(v.status === "available" ? "جاهز" : v.status === "on-route" ? "بالطريق" : v.status === "loading" ? "تحميل" : "تم", v.status)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </TiltCardContent>
              </Card>
            </TiltCard>
          </ScrollReveal>

          {/* ── PROCUREMENT STATUS ── */}
          <ScrollReveal direction="right" delay={0.3}>
            <TiltCard intensity={4}>
              <Card className="p-4 sm:p-5 overflow-hidden relative h-full">
                <TiltCardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-sm sm:text-base font-semibold">{t("المشتريات", "Procurement")}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                    <div className="rounded-lg bg-amber-500/10 p-2.5 sm:p-3 text-center">
                      <p className="text-lg sm:text-xl font-bold text-amber-500 tabular-nums">{pendingProc}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t("قيد الانتظار", "Pending")}</p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2.5 sm:p-3 text-center">
                      <p className="text-lg sm:text-xl font-bold text-primary tabular-nums truncate">{procTotalPending > 0 ? fmtCurrency(procTotalPending) : "0"}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t("القيمة المعلقة", "Pending Value")}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                    <span>{t("إجمالي الموردين", "Total Suppliers")}: {procOrders.reduce((s, o) => s.add(o.supplierName), new Set<string>()).size}</span>
                    <Badge variant="outline" className="text-[9px] sm:text-[10px]">{procOrders.length} {t("أمر", "orders")}</Badge>
                  </div>
                </TiltCardContent>
              </Card>
            </TiltCard>
          </ScrollReveal>
        </div>
      </div>

      {/* ═══ RECENT ACTIVITY ═══ */}
      <ScrollReveal direction="up" delay={0.3}>
        <TiltCard intensity={4}>
          <Card className="p-4 sm:p-6 overflow-hidden relative">
            <TiltCardContent>
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm sm:text-lg font-semibold">{t("النشاط الأخير", "Recent Activity")}</h3>
                </div>
                <Badge variant="outline" className="text-[9px] sm:text-xs">{t("آخر 5 أحداث", "Last 5 events")}</Badge>
              </div>
              <div className="space-y-0">
                {recentActivity.length > 0 ? recentActivity.map((activity, i) => (
                  <motion.div key={activity.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.08 }}
                    className="flex gap-3 sm:gap-4 relative pb-4 sm:pb-5 last:pb-0">
                    {i !== recentActivity.length - 1 && <div className="absolute top-8 bottom-0 end-[15px] sm:end-[19px] w-px bg-gradient-to-b from-border to-transparent z-0" />}
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 + i * 0.08, type: "spring", stiffness: 300 }}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-secondary flex items-center justify-center z-10 shrink-0 border-2 border-card">
                      {activity.type === "production" && <Factory className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />}
                      {activity.type === "inventory" && <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />}
                      {activity.type === "fleet" && <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" />}
                      {activity.type === "sales" && <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500" />}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium leading-snug">{activity.action}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                    </div>
                  </motion.div>
                )) : (
                  <div className="text-center py-8 text-muted-foreground text-xs sm:text-sm">{t("لا توجد أنشطة حتى الآن", "No activity yet")}</div>
                )}
              </div>
            </TiltCardContent>
          </Card>
        </TiltCard>
      </ScrollReveal>

      {/* ═══ REPORT DIALOG ═══ */}
      <Dialog open={reportOpen} onOpenChange={v => { if (!generating) setReportOpen(v); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t("إنشاء تقرير جديد", "Generate New Report")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!generating && !reportGenerated && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">{t("نوع التقرير", "Report Type")}</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger data-testid="select-report-type" className="text-xs sm:text-sm">
                      <SelectValue placeholder={t("اختر نوع التقرير", "Select report type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">{t("تقرير المبيعات", "Sales Report")}</SelectItem>
                      <SelectItem value="production">{t("تقرير الإنتاج", "Production Report")}</SelectItem>
                      <SelectItem value="profit">{t("تقرير الأرباح", "Profit Report")}</SelectItem>
                      <SelectItem value="inventory">{t("تقرير المخزون", "Inventory Report")}</SelectItem>
                      <SelectItem value="hr">{t("تقرير الموارد البشرية", "HR Report")}</SelectItem>
                      <SelectItem value="executive">{t("ملخص تنفيذي", "Executive Summary")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">{t("الفترة الزمنية", "Time Period")}</Label>
                  <Select value={reportPeriod} onValueChange={setReportPeriod}>
                    <SelectTrigger data-testid="select-report-period" className="text-xs sm:text-sm">
                      <SelectValue placeholder={t("اختر الفترة", "Select period")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">{t("اليوم", "Today")}</SelectItem>
                      <SelectItem value="week">{t("الأسبوع الحالي", "This Week")}</SelectItem>
                      <SelectItem value="month">{t("الشهر الحالي", "This Month")}</SelectItem>
                      <SelectItem value="quarter">{t("الربع الحالي", "This Quarter")}</SelectItem>
                      <SelectItem value="year">{t("السنة الحالية", "This Year")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 pt-2">
                  <RippleEffect className="flex-1">
                    <Button className="w-full gap-2 text-xs sm:text-sm" onClick={handleGenerateReport} disabled={!reportType || !reportPeriod} data-testid="button-generate-report">
                      <FileText className="w-3.5 h-3.5" />{t("إنشاء", "Generate")}
                    </Button>
                  </RippleEffect>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={() => setReportOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </div>
              </>
            )}
            {generating && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 flex flex-col items-center gap-4">
                <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                  <motion.div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  <div className="absolute inset-0 flex items-center justify-center"><FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /></div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("جاري إنشاء التقرير...", "Generating...")}</p>
              </motion.div>
            )}
            {reportGenerated && (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-4 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, delay: 0.1 }} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500" />
                  </motion.div>
                  <p className="text-sm sm:text-base font-semibold text-emerald-500">{t("تم إنشاء التقرير!", "Report generated!")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="gap-2 text-xs sm:text-sm" data-testid="button-download-report" onClick={handleDownloadPDF}><Download className="w-3.5 h-3.5" />{t("تحميل PDF", "Download PDF")}</Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={() => setReportOpen(false)}>{t("إغلاق", "Close")}</Button>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── KPI CARD ─── */
function KpiCard({ title, value, icon: Icon, alert = false, sub }: { title: string; value: string | React.ReactNode; icon: React.ElementType; alert?: boolean; sub?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const onMouseMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    gsap.to(el, { backgroundPosition: `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`, duration: 0.3, ease: "power2.out" });
  };
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
      <TiltCard intensity={6}>
        <div ref={cardRef} onMouseMove={onMouseMove}
          className={`rounded-xl p-4 sm:p-5 relative overflow-hidden group border ${alert ? "border-destructive/50 bg-destructive/5" : "border-border/50 bg-card"}`}
          style={{ backgroundImage: "radial-gradient(circle at 0% 0%, hsl(var(--primary)/0.06), transparent 60%)", backgroundSize: "200% 200%" }}>
          <TiltCardContent>
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1">{title}</p>
                <h3 className="text-lg sm:text-2xl font-bold tracking-tight tabular-nums truncate">{value}</h3>
              </div>
              <motion.div whileHover={{ rotate: [0, -12, 12, -6, 6, 0], transition: { duration: 0.5 } }}
                className={`p-2 sm:p-3 rounded-lg shrink-0 ${alert ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary"}`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.div>
            </div>
            {sub && <p className={`text-[10px] sm:text-xs ${alert ? "text-destructive/70" : "text-muted-foreground"}`}>{sub}</p>}
            <div className="absolute -bottom-4 -right-4 w-20 sm:w-24 h-20 sm:h-24 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-500" />
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 1px 0 hsl(var(--primary)/0.1)" }} />
          </TiltCardContent>
        </div>
      </TiltCard>
    </motion.div>
  );
}

/* ─── MINI KPI ─── */
function MiniKpi({ icon, label, value, color, bg, sub }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.02 }} transition={{ delay: 0.1 }}
      className={`rounded-xl ${bg} border border-border/40 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3`}>
      <div className={`${color} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-sm sm:text-lg font-bold ${color} tabular-nums`}>{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate">{label}</p>
        {sub && <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 truncate">{sub}</p>}
      </div>
    </motion.div>
  );
}

/* ─── PRODUCTION MINI KPI ─── */
function ProdKpi({ icon, label, value, suffix = "", color, bg }: { icon: React.ReactNode; label: string; value: number; suffix?: string; color: string; bg: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.04, transition: { duration: 0.15 } }}
      className={`rounded-xl ${bg} px-2 sm:px-3 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-2.5`}>
      <div className={`${color} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-sm sm:text-lg font-bold ${color} tabular-nums`}><AnimatedNumber target={value} />{suffix}</p>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
      </div>
    </motion.div>
  );
}
