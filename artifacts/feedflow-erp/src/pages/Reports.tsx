import React, { useState, useMemo } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useSalesStore } from "@/hooks/use-sales-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { useFleetStore } from "@/hooks/use-fleet-store";
import { useProcurementStore } from "@/hooks/use-procurement-store";
import { usePricingStore } from "@/hooks/use-pricing-store";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { containerVariants, itemVariants } from "@/lib/animations";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, Download, CheckCircle2, TrendingUp, DollarSign, AlertTriangle, Users, Truck, ShoppingCart, Factory, Package } from "lucide-react";

type DateMode = "all" | "today" | "range";

export default function Reports() {
  const { t, companyName, companyLogo, companyAddress } = useAppStore();
  const { invoices, customers } = useSalesStore();
  const { inventory, orders: prodOrders } = useProductionStore();
  const { employees, attendance } = useHRStore();
  const { vehicles, shipments } = useFleetStore();
  const { suppliers, orders } = useProcurementStore();
  const { productPrices, pricingAlerts } = usePricingStore();

  const todayStr = new Date().toISOString().split("T")[0];
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repSales, setRepSales] = useState(true);
  const [repInv, setRepInv] = useState(true);
  const [repHR, setRepHR] = useState(true);
  const [repFleet, setRepFleet] = useState(true);
  const [repProc, setRepProc] = useState(true);
  const [repPriceList, setRepPriceList] = useState(true);
  const [repPricingAlerts, setRepPricingAlerts] = useState(true);
  const [repMargins, setRepMargins] = useState(true);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

  const dateFilter = <T extends { date?: string }>(items: T[]) => items.filter(i => {
    if (!i.date) return true;
    if (repDateMode === "today") return i.date === todayStr;
    if (repDateMode === "range") {
      if (repDateFrom && i.date < repDateFrom) return false;
      if (repDateTo && i.date > repDateTo) return false;
    }
    return true;
  });

  const attendanceArray: { employeeId: string; date: string; status: string }[] = useMemo(() => {
    const arr: { employeeId: string; date: string; status: string }[] = [];
    Object.entries(attendance).forEach(([empId, dates]) => {
      Object.entries(dates).forEach(([date, status]) => {
        arr.push({ employeeId: empId, date, status });
      });
    });
    return arr;
  }, [attendance]);

  // ── Chart Data ──
  const WEEKDAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const weeklySalesData = useMemo(() =>
    WEEKDAYS.map((name, idx) => {
      const dayInvs = invoices.filter(i => {
        const d = new Date(i.date);
        return d.getDay() === idx && i.status !== "pending";
      });
      return { name, value: dayInvs.reduce((s, i) => s + i.total, 0) };
    }), [invoices]);

  const productData = useMemo(() =>
    Object.entries(prodOrders.filter(o => o.status === "completed").reduce((acc, o) => {
      acc[o.productName] = (acc[o.productName] || 0) + (o.producedTons || 0);
      return acc;
    }, {} as Record<string, number>)).map(([name, tons]) => ({ name, tons })), [prodOrders]);

  const invTypeData = useMemo(() => [
    { name: t("خام", "Raw"), value: inventory.filter(i => i.type === "raw").length },
    { name: t("مصنع", "Finished"), value: inventory.filter(i => i.type === "finished").length },
  ], [inventory, t]);

  const INV_COLORS = ["#2563eb", "#16a34a"];

  // ── Pricing Data ──
  const activeAlerts = useMemo(() => pricingAlerts.filter(a => !a.dismissed), [pricingAlerts]);
  const avgMargin = useMemo(() => {
    const withCost = productPrices.filter(p => p.costPrice > 0 && p.wholeSalePrice > 0);
    if (withCost.length === 0) return 0;
    return withCost.reduce((s, p) => s + ((p.wholeSalePrice - p.costPrice) / p.costPrice) * 100, 0) / withCost.length;
  }, [productPrices]);

  const pricingTableData = useMemo(() => productPrices.map(p => {
    const inv = inventory.find(i => i.materialName === p.productName || i.id === p.productId.replace(/^inv-/, ""));
    const margin = p.costPrice > 0 ? ((p.wholeSalePrice - p.costPrice) / p.costPrice * 100) : 0;
    return {
      ...p,
      invQty: inv ? `${inv.quantity} ${inv.unit === "ton" ? "ط" : inv.unit === "kg" ? "كجم" : "ش"}` : "—",
      margin: Math.round(margin * 10) / 10,
    };
  }), [productPrices, inventory]);

  const handleGenerate = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };

  const handleDownload = () => {
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = repDateMode === "all" ? t("كل الفترة", "All Period") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;

    const filtInvs = dateFilter(invoices);
    const filtShip = dateFilter(shipments);
    const filtOrders = dateFilter(orders);
    const filtAtt = dateFilter(attendanceArray);

    const totalRevenue = filtInvs.reduce((s, i) => s + i.total, 0);
    const totalPaid = filtInvs.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const activeEmps = employees.filter(e => e.status === "active").length;
    const presentCount = filtAtt.filter(a => a.status === "present" || a.status === "late").length;
    const absentCount = filtAtt.filter(a => a.status === "absent").length;
    const totalShipWeight = filtShip.reduce((s, sh) => s + (sh.totalWeight || 0), 0);
    const totalPOs = filtOrders.length;
    const totalPOCost = filtOrders.reduce((s, o) => s + (o.total || 0), 0);
    const rawItems = inventory.filter(i => i.type === "raw");
    const finishedItems = inventory.filter(i => i.type === "finished");
    const lowStockItems = inventory.filter(i => i.alertLevel === "critical" || i.alertLevel === "warning");

    const styles = `
      @page{size:A4 landscape;margin:12mm 16mm}
      body{font-family:'Segoe UI',Tahoma,sans-serif;direction:rtl;color:#1e293b;line-height:1.6;font-size:11px}
      .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100px;font-weight:900;color:rgba(37,99,235,.04);pointer-events:none;z-index:-1;letter-spacing:8px;white-space:nowrap}
      .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:18px;gap:20px}
      .header-right{text-align:right}.header-left{text-align:left;color:#64748b;font-size:10px;line-height:1.5}
      .header h1{font-size:18px;margin:0 0 2px;color:#1d4ed8;font-weight:800}
      .header .sub{font-size:11px;color:#64748b;margin:0}
      .header .company{font-size:12px;font-weight:700;color:#1e293b}
      .meta{display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:16px;padding:6px 10px;background:#f8fafc;border-radius:6px}
      .section{margin-bottom:16px;break-inside:avoid}
      .section h2{font-size:13px;border-bottom:2px solid #e2e8f0;padding-bottom:5px;margin:0 0 8px;color:#1d4ed8;font-weight:700;display:flex;align-items:center;gap:5px}
      .section h2:before{content:'';display:inline-block;width:3px;height:14px;background:#1d4ed8;border-radius:2px}
      .grid{display:flex;gap:6px;flex-wrap:wrap}
      .card{flex:1;min-width:80px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 6px;text-align:center;background:#fff}
      .card .num{font-size:15px;font-weight:800}.card .lbl{font-size:9px;color:#64748b;margin-top:1px}
      .num-blue{color:#1d4ed8}.num-green{color:#15803d}.num-red{color:#dc2626}.num-amber{color:#b45309}
      table{width:100%;border-collapse:collapse;margin:4px 0;font-size:10px;border-radius:4px;overflow:hidden}
      th{background:#1d4ed8;color:#fff;font-weight:600;padding:5px 4px;font-size:10px}
      td{border:1px solid #e2e8f0;padding:4px}
      tr:nth-child(even){background:#f8fafc}
      .footer{text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:20px}
      .footer-logo{font-weight:700;color:#1d4ed8}
    `;
    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right"><h1>${t("تقرير شامل", "Executive Summary")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:45px;margin-bottom:3px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>📊 ${t("تقرير شامل للأداء", "Executive Summary Report")}</span><span>📅 ${periodLabel}</span></div>
      ${repSales ? `<div class="section"><h2>${t("المبيعات", "Sales")}</h2><div class="grid"><div class="card"><div class="num num-blue">${filtInvs.length}</div><div class="lbl">${t("الفواتير", "Invoices")}</div></div><div class="card"><div class="num num-blue">${fmtCurrency(totalRevenue)}</div><div class="lbl">${t("الإيرادات", "Revenue")}</div></div><div class="card"><div class="num num-green">${fmtCurrency(totalPaid)}</div><div class="lbl">${t("المدفوع", "Paid")}</div></div><div class="card"><div class="num num-amber">${customers.length}</div><div class="lbl">${t("العملاء", "Customers")}</div></div></div></div>` : ""}
      ${repInv ? `<div class="section"><h2>${t("المخزون", "Inventory")}</h2><div class="grid"><div class="card"><div class="num num-blue">${rawItems.length}</div><div class="lbl">${t("مواد خام", "Raw Materials")}</div></div><div class="card"><div class="num num-blue">${finishedItems.length}</div><div class="lbl">${t("منتج تام", "Finished")}</div></div><div class="card"><div class="num num-red">${lowStockItems.length}</div><div class="lbl">${t("مخزون منخفض", "Low Stock")}</div></div></div>${lowStockItems.length > 0 ? `<table><tr><th>${t("الصنف", "Item")}</th><th>${t("النوع", "Type")}</th><th>${t("الكمية", "Qty")}</th><th>${t("التنبيه", "Alert")}</th></tr>${lowStockItems.slice(0, 10).map(i => `<tr><td><strong>${i.materialName}</strong></td><td>${i.type === "raw" ? t("خام","Raw") : t("مصنع","Finished")}</td><td style="color:#dc2626;font-weight:600">${i.quantity}</td><td><span class="badge ${i.alertLevel === "critical" ? "badge-red" : "badge-amber"}">${i.alertLevel === "critical" ? t("حرج","Critical") : t("تحذير","Warning")}</span></td></tr>`).join("")}</table>` : ""}</div>` : ""}
      ${repHR ? `<div class="section"><h2>${t("الموارد البشرية", "Human Resources")}</h2><div class="grid"><div class="card"><div class="num num-blue">${employees.length}</div><div class="lbl">${t("إجمالي الموظفين", "Employees")}</div></div><div class="card"><div class="num num-green">${activeEmps}</div><div class="lbl">${t("نشط", "Active")}</div></div><div class="card"><div class="num num-green">${presentCount}</div><div class="lbl">${t("حاضر", "Present")}</div></div><div class="card"><div class="num num-red">${absentCount}</div><div class="lbl">${t("غائب", "Absent")}</div></div></div></div>` : ""}
      ${repFleet ? `<div class="section"><h2>${t("الناقلات", "Fleet")}</h2><div class="grid"><div class="card"><div class="num num-blue">${vehicles.length}</div><div class="lbl">${t("الناقلات", "Vehicles")}</div></div><div class="card"><div class="num num-blue">${filtShip.length}</div><div class="lbl">${t("الشحنات", "Shipments")}</div></div><div class="card"><div class="num num-green">${filtShip.filter(s => s.status === "delivered").length}</div><div class="lbl">${t("تم التسليم", "Delivered")}</div></div><div class="card"><div class="num num-amber">${fmtCurrency(totalShipWeight)}</div><div class="lbl">${t("الوزن", "Weight")}</div></div></div></div>` : ""}
      ${repProc ? `<div class="section"><h2>${t("المشتريات", "Procurement")}</h2><div class="grid"><div class="card"><div class="num num-blue">${suppliers.length}</div><div class="lbl">${t("الموردين", "Suppliers")}</div></div><div class="card"><div class="num num-blue">${totalPOs}</div><div class="lbl">${t("أوامر الشراء", "POs")}</div></div><div class="card"><div class="num num-green">${filtOrders.filter(o => o.status === "delivered" || o.status === "paid").length}</div><div class="lbl">${t("مكتمل", "Completed")}</div></div><div class="card"><div class="num num-amber">${fmtCurrency(totalPOCost)}</div><div class="lbl">${t("التكلفة", "Cost")}</div></div></div></div>` : ""}
      ${repPriceList ? `<div class="section"><h2>${t("قائمة الأسعار", "Price List")}</h2><div class="grid"><div class="card"><div class="num num-blue">${productPrices.length}</div><div class="lbl">${t("منتج مسعر", "Priced")}</div></div><div class="card"><div class="num num-green">${avgMargin > 0 ? `${Math.round(avgMargin)}%` : "—"}</div><div class="lbl">${t("متوسط الهامش", "Avg Margin")}</div></div></div><table><tr><th>${t("المنتج","Product")}</th><th>${t("كود","Code")}</th><th>${t("التكلفة","Cost")}</th><th>${t("الجملة","Wholesale")}</th><th>${t("القطاعي","Retail")}</th><th>${t("الموزع","Distributor")}</th><th>${t("الهامش","Margin")}</th></tr>${pricingTableData.slice(0, 15).map(p => `<tr><td><strong>${p.productName}</strong></td><td>${p.productCode}</td><td>${fmtCurrency(p.costPrice)}</td><td>${fmtCurrency(p.wholeSalePrice)}</td><td>${fmtCurrency(p.retailPrice)}</td><td>${fmtCurrency(p.distributorPrice)}</td><td style="color:${p.margin >= 20 ? "#15803d" : p.margin >= 10 ? "#b45309" : "#dc2626"};font-weight:600">%${p.margin}</td></tr>`).join("")}</table></div>` : ""}
      ${repMargins ? `<div class="section"><h2>${t("الهوامش", "Margins")}</h2><div class="grid"><div class="card"><div class="num num-amber">${pricingTableData.filter(p => p.costPrice > 0 && p.wholeSalePrice > 0 && p.margin >= 20).length}</div><div class="lbl">${t("هامش >= 20%", "Margin >= 20%")}</div></div><div class="card"><div class="num num-green">${pricingTableData.filter(p => p.costPrice > 0 && p.wholeSalePrice > 0 && p.margin >= 10 && p.margin < 20).length}</div><div class="lbl">${t("هامش 10-20%", "Margin 10-20%")}</div></div><div class="card"><div class="num num-red">${pricingTableData.filter(p => p.costPrice > 0 && p.wholeSalePrice > 0 && p.margin < 10).length}</div><div class="lbl">${t("هامش < 10%", "Margin < 10%")}</div></div></div></div>` : ""}
      ${repPricingAlerts ? `<div class="section"><h2>${t("التنبيهات", "Alerts")}</h2>${activeAlerts.length > 0 ? `<table><tr><th>${t("المنتج","Product")}</th><th>${t("التكلفة","Cost")}</th><th>${t("السبب","Reason")}</th><th>${t("التاريخ","Date")}</th></tr>${activeAlerts.slice(0, 10).map(a => `<tr><td><strong>${a.productName}</strong></td><td>${fmtCurrency(a.costPrice)}</td><td>${a.reason === "production" ? t("إنتاج","Production") : t("مشتريات","Procurement")}</td><td>${new Date(a.date).toLocaleDateString("ar-EG")}</td></tr>`).join("")}</table>` : `<p>${t("لا توجد تنبيهات نشطة", "No active alerts")}</p>`}</div>` : ""}
      <div class="footer"><p><span class="footer-logo">${companyName || "تاج"}</span> — ${t("جميع الحقوق محفوظة", "All rights reserved")} © ${new Date().getFullYear()}</p><p style="margin-top:2px">${t("تم إنشاؤه بواسطة", "Generated by")} تاج — ${nowStr}</p></div>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>' + styles + '</style></head><body>' + content + '</body></html>');
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("التقارير", "Reports")}</h1>
          <p className="text-muted-foreground mt-1">{t("تقرير شامل للأداء", "Executive summary report")}</p>
        </div>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setRepOpen(true)}>
          <BarChart3 className="w-4 h-4" />{t("تقرير شامل", "Executive Report")}
        </Button>
      </div>

      {/* KPI Cards */}
      <motion.div variants={containerVariants} initial={false} animate="show" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
        {[
          { label: t("فواتير البيع", "Sales Invoices"), val: invoices.length, color: "text-primary" },
          { label: t("الإيرادات", "Revenue"), val: fmtCurrency(invoices.reduce((s, i) => s + i.total, 0)), color: "text-emerald-500" },
          { label: t("الموظفين النشطين", "Active Employees"), val: employees.filter(e => e.status === "active").length, color: "text-amber-500" },
          { label: t("أصناف المخزون", "Inventory Items"), val: inventory.length, color: "text-blue-500" },
          { label: t("الشحنات", "Shipments"), val: shipments.length, color: "text-red-500" },
          { label: t("أسعار", "Prices"), val: productPrices.length, color: "text-violet-500" },
          { label: t("متوسط الهامش", "Avg Margin"), val: `${Math.round(avgMargin)}%`, color: "text-cyan-500" },
        ].map((k, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="p-3 text-center">
              <div className={`text-lg sm:text-2xl font-bold ${k.color}`}>{k.val}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">{k.label}</div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Module Summary Cards */}
      <motion.div variants={containerVariants} initial={false} animate="show" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {[
          { key: "s", label: t("المبيعات", "Sales"), val: invoices.length, color: "bg-blue-500/10 text-blue-600" },
          { key: "i", label: t("المخزون", "Inventory"), val: inventory.length, color: "bg-emerald-500/10 text-emerald-600" },
          { key: "h", label: t("الموارد البشرية", "HR"), val: employees.length, color: "bg-amber-500/10 text-amber-600" },
          { key: "f", label: t("الناقلات", "Fleet"), val: vehicles.length, color: "bg-purple-500/10 text-purple-600" },
          { key: "p", label: t("المشتريات", "Procurement"), val: suppliers.length, color: "bg-red-500/10 text-red-600" },
          { key: "pr", label: t("التسعير", "Pricing"), val: productPrices.length, color: "bg-violet-500/10 text-violet-600" },
        ].map(m => (
          <motion.div key={m.key} variants={itemVariants}>
            <Card className="p-3 text-center hover:border-primary/50 transition-all cursor-pointer">
              <div className={`text-lg font-bold ${m.color}`}>{m.val}</div>
              <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Enhanced Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
        <motion.div variants={itemVariants}>
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm sm:text-base font-semibold">{t("المبيعات الأسبوعية", "Weekly Sales")}</h3>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklySalesData}>
                  <defs>
                    <linearGradient id="reportSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v / 1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(value)} />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#reportSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm sm:text-base font-semibold">{t("توزيع المخزون", "Inventory Composition")}</h3>
            </div>
            <div className="flex items-center justify-center h-[220px]">
              {invTypeData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={invTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                      {invTypeData.map((_, i) => <Cell key={i} fill={INV_COLORS[i % INV_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm">{t("لا توجد بيانات", "No data")}</p>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {productData.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Factory className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm sm:text-base font-semibold">{t("إنتاج المنتجات", "Product Output (Tons)")}</h3>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="tons" name={t("أطنان", "Tons")} fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ═══ Pricing & Cost Section ═══ */}
      <motion.div variants={itemVariants} className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg sm:text-xl font-bold">{t("التسعير والتكلفة", "Pricing & Cost")}</h2>
          <Badge variant="outline" className="text-[10px]">{t("قائمة الأسعار", "Price List")}</Badge>
        </div>

        {/* Pricing KPI mini-cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="p-3 text-center bg-violet-500/5 border-violet-500/20">
            <p className="text-lg font-bold text-violet-600">{productPrices.length}</p>
            <p className="text-[10px] text-muted-foreground">{t("منتج مسعر", "Priced Products")}</p>
          </Card>
          <Card className="p-3 text-center bg-emerald-500/5 border-emerald-500/20">
            <p className="text-lg font-bold text-emerald-600">{avgMargin > 0 ? `${Math.round(avgMargin)}%` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">{t("متوسط الهامش", "Avg Margin")}</p>
          </Card>
          <Card className={`p-3 text-center ${activeAlerts.length > 0 ? "bg-red-500/5 border-red-500/20" : "bg-muted/30"}`}>
            <p className={`text-lg font-bold ${activeAlerts.length > 0 ? "text-red-600" : "text-muted-foreground"}`}>{activeAlerts.length}</p>
            <p className="text-[10px] text-muted-foreground">{t("تنبيهات", "Alerts")}</p>
          </Card>
          <Card className="p-3 text-center bg-cyan-500/5 border-cyan-500/20">
            <p className="text-lg font-bold text-cyan-600">{pricingTableData.filter(p => p.costPrice > 0 && p.wholeSalePrice > 0 && p.margin >= 20).length}</p>
            <p className="text-[10px] text-muted-foreground">{t("هامش >= 20%", "Margin >= 20%")}</p>
          </Card>
        </div>

        {/* Price List Table */}
        <Card className="p-3 sm:p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold">{t("قائمة الأسعار", "Price List")}</h3>
            <span className="text-[10px] text-muted-foreground">({productPrices.length} {t("منتج", "products")})</span>
          </div>
          <div className="min-w-[500px] sm:min-w-[900px]">
            <table className="w-full text-[10px] sm:text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-right p-1.5 sm:p-2 font-medium text-muted-foreground">{t("المنتج", "Product")}</th>
                  <th className="text-right p-1.5 sm:p-2 font-medium text-muted-foreground hidden sm:table-cell">{t("كود", "Code")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground hidden md:table-cell">{t("المخزون", "Stock")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground hidden lg:table-cell">{t("التركيبة", "Formula")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground">{t("التكلفة", "Cost")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground">{t("الجملة", "Wholesale")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground hidden lg:table-cell">{t("القطاعي", "Retail")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground hidden xl:table-cell">{t("الموزع", "Distributor")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground hidden xl:table-cell">{t("الحد الأدنى", "Min")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground">{t("الهامش", "Margin")}</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium text-muted-foreground hidden md:table-cell">{t("آخر تحديث", "Updated")}</th>
                </tr>
              </thead>
              <tbody>
                {pricingTableData.slice(0, 20).map(p => (
                  <tr key={p.productId} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-1.5 sm:p-2 font-medium">{p.productName}</td>
                    <td className="p-1.5 sm:p-2 text-muted-foreground hidden sm:table-cell">{p.productCode}</td>
                    <td className="p-1.5 sm:p-2 text-center hidden md:table-cell">{p.invQty}</td>
                    <td className="p-1.5 sm:p-2 text-center text-muted-foreground hidden lg:table-cell">{p.productCode === "خام" ? "—" : t("نعم", "Yes")}</td>
                    <td className="p-1.5 sm:p-2 text-center font-mono">{p.costPrice.toLocaleString("ar-EG")}</td>
                    <td className="p-1.5 sm:p-2 text-center font-mono">{p.wholeSalePrice.toLocaleString("ar-EG")}</td>
                    <td className="p-1.5 sm:p-2 text-center font-mono hidden lg:table-cell">{p.retailPrice.toLocaleString("ar-EG")}</td>
                    <td className="p-1.5 sm:p-2 text-center font-mono hidden xl:table-cell">{p.distributorPrice.toLocaleString("ar-EG")}</td>
                    <td className="p-1.5 sm:p-2 text-center font-mono hidden xl:table-cell">{p.minSalePrice.toLocaleString("ar-EG")}</td>
                    <td className={`p-1.5 sm:p-2 text-center font-bold ${p.margin >= 20 ? "text-emerald-600" : p.margin >= 10 ? "text-amber-600" : "text-red-600"}`}>
                      {p.margin}%
                    </td>
                    <td className="p-1.5 sm:p-2 text-center text-[9px] text-muted-foreground hidden md:table-cell">{p.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pricingTableData.length > 20 && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">{t(`...و ${pricingTableData.length - 20} منتج آخر`, `...and ${pricingTableData.length - 20} more products`)}</p>
            )}
          </div>
        </Card>

        {/* Margins & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-cyan-500" />
              <h3 className="text-sm font-semibold">{t("الهوامش", "Margins")}</h3>
            </div>
            <div className="space-y-1.5">
              {pricingTableData.filter(p => p.costPrice > 0).sort((a, b) => b.margin - a.margin).slice(0, 10).map(p => (
                <div key={p.productId} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                  <span className="text-[10px] sm:text-xs truncate max-w-[100px] sm:max-w-[160px]">{p.productName}</span>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-14 sm:w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${p.margin >= 20 ? "bg-emerald-500" : p.margin >= 10 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(100, p.margin)}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold w-10 text-right ${p.margin >= 20 ? "text-emerald-600" : p.margin >= 10 ? "text-amber-600" : "text-red-600"}`}>
                      %{p.margin}
                    </span>
                  </div>
                </div>
              ))}
              {pricingTableData.filter(p => p.costPrice > 0).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{t("لا توجد بيانات", "No data")}</p>
              )}
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold">{t("التنبيهات", "Alerts")}</h3>
              {activeAlerts.length > 0 && (
                <Badge className="bg-red-500/10 text-red-600 border-red-500/30 text-[9px]">{activeAlerts.length}</Badge>
              )}
            </div>
            <div className="space-y-1.5">
              {activeAlerts.length > 0 ? activeAlerts.slice(0, 10).map((a, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{a.productName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("التكلفة", "Cost")}: {a.costPrice.toLocaleString("ar-EG")} — {a.reason === "production" ? t("تغير في الإنتاج", "Production change") : t("تغير في المشتريات", "Procurement change")}
                    </p>
                    <p className="text-[9px] text-muted-foreground/50">{new Date(a.date).toLocaleDateString("ar-EG")}</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground text-center py-4">{t("لا توجد تنبيهات نشطة", "No active alerts")}</p>
              )}
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Report Dialog */}
      <Dialog open={repOpen} onOpenChange={v => { if (!repGenerating) setRepOpen(v); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t("تقرير شامل", "Executive Report")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!repGenerating && !repGenerated && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">{t("الفترة", "Period")}</Label>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {([{ mode: "all" as DateMode, label: t("الكل", "All") }, { mode: "today" as DateMode, label: t("اليوم", "Today") }, { mode: "range" as DateMode, label: t("مخصص", "Custom") }]).map(d => (
                      <button key={d.mode} onClick={() => { setRepDateMode(d.mode); if (d.mode !== "range") { setRepDateFrom(""); setRepDateTo(""); } }}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${repDateMode === d.mode ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>{d.label}</button>
                    ))}
                  </div>
                  {repDateMode === "range" && (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mt-2">
                      <Input type="date" className="h-8 text-xs w-28 sm:w-36 rounded-lg" value={repDateFrom} onChange={e => setRepDateFrom(e.target.value)} />
                      <span className="text-muted-foreground text-xs">{t("إلى", "to")}</span>
                      <Input type="date" className="h-8 text-xs w-28 sm:w-36 rounded-lg" value={repDateTo} onChange={e => setRepDateTo(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs sm:text-sm">{t("الأقسام", "Sections")}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { key: "sales", label: t("المبيعات", "Sales"), val: repSales, set: setRepSales },
                      { key: "inv", label: t("المخزون", "Inventory"), val: repInv, set: setRepInv },
                      { key: "hr", label: t("الموارد البشرية", "HR"), val: repHR, set: setRepHR },
                      { key: "fleet", label: t("الناقلات", "Fleet"), val: repFleet, set: setRepFleet },
                      { key: "proc", label: t("المشتريات", "Procurement"), val: repProc, set: setRepProc },
                      { key: "priceList", label: t("قائمة الأسعار", "Price List"), val: repPriceList, set: setRepPriceList },
                      { key: "margins", label: t("الهوامش", "Margins"), val: repMargins, set: setRepMargins },
                      { key: "pricingAlerts", label: t("التنبيهات", "Alerts"), val: repPricingAlerts, set: setRepPricingAlerts },
                    ].map(s => (
                      <button key={s.key} type="button" onClick={() => s.set(!s.val)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all ${s.val ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border/50 text-muted-foreground hover:border-border"}`}>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${s.val ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                          {s.val && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button className="flex-1 gap-2 text-xs sm:text-sm" onClick={handleGenerate} disabled={repDateMode === "range" && !repDateFrom && !repDateTo}>
                    <BarChart3 className="w-3.5 h-3.5" />{t("إنشاء التقرير", "Generate")}
                  </Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={() => setRepOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </div>
              </>
            )}
            {repGenerating && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 flex flex-col items-center gap-4">
                <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                  <motion.div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  <div className="absolute inset-0 flex items-center justify-center"><BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /></div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("جاري إنشاء التقرير...", "Generating...")}</p>
              </motion.div>
            )}
            {repGenerated && (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-4 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, delay: 0.1 }} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500" />
                  </motion.div>
                  <p className="text-sm sm:text-base font-semibold text-emerald-500">{t("تم إنشاء التقرير!", "Report generated!")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="gap-2 text-xs sm:text-sm" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5" />{t("تحميل PDF", "Download PDF")}
                  </Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={() => { setRepOpen(false); setRepGenerated(false); }}>{t("إغلاق", "Close")}</Button>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
