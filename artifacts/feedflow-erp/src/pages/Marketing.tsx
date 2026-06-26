import React, { useState } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SmartInput from "@/components/SmartInput";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Target, Trophy, Plus, CheckCircle2, Users, TrendingUp, DollarSign, BarChart3, Download, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function Marketing() {
  const { t } = useAppStore();
  const { addEmployee, addDepartment, departments, shifts } = useHRStore();
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [selectedMarketer, setSelectedMarketer] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [commissionDone, setCommissionDone] = useState(false);

  const [marketers, setMarketers] = useState<any[]>([]);

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repSummary, setRepSummary] = useState(true);
  const [repMarketers, setRepMarketers] = useState(true);
  const [repPerformance, setRepPerformance] = useState(true);

  // Add form
  const [mName, setMName] = useState("");
  const [mRegion, setMRegion] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mHireDate, setMHireDate] = useState("");
  const [mSalary, setMSalary] = useState("");
  const [mCommType, setMCommType] = useState("");
  const [mCommRate, setMCommRate] = useState("");
  const [mTarget, setMTarget] = useState("");

  // Commission payout form
  const [payoutMethod, setPayoutMethod] = useState("");

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(num);

  const handleAdd = () => {
    if (!mName || !mRegion || !mCommType) return;
    setMarketers(prev => [...prev, {
      id: `M${prev.length + 1}`,
      name: mName,
      region: mRegion,
      customersCount: 0,
      totalSales: 0,
      commission: 0,
      target: parseFloat(mTarget) || 1000000,
    }]);
    if (!departments.includes("التسويق")) addDepartment("التسويق");
    const marketingShift = shifts.find(sh => (sh.departments || []).includes("التسويق"));
    addEmployee({
      name: mName,
      phone: mPhone,
      department: "التسويق",
      position: "مندوب تسويق",
      salaryType: "monthly",
      baseSalary: parseFloat(mSalary) || 0,
      dailyIncentive: 0,
      lateDeductionPct: 0,
      status: "present",
      allowances: 0,
      overtime: 0,
      deductions: 0,
      advances: 0,
      joinDate: mHireDate || new Date().toISOString().split("T")[0],
      notes: "",
      workStartTime: marketingShift?.startTime || "08:00",
      workEndTime: marketingShift?.endTime || "16:00",
      workHours: marketingShift ? (() => { const [h1, m1] = marketingShift.startTime.split(":").map(Number); const [h2, m2] = marketingShift.endTime.split(":").map(Number); return h2 > h1 ? h2 - h1 : 24 - h1 + h2; })() : 8,
      overtimeRate: 1.5,
      commissionType: mCommType === "pct" ? "pct" : mCommType === "per_ton" ? "per_ton" : mCommType === "tiered" ? "tiered" : "none",
      commissionRate: mCommType === "pct" ? (parseFloat(mCommRate) || 0) : mCommType === "per_ton" ? (parseFloat(mCommRate) || 0) : 0,
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false); setAddOpen(false);
      setMName(""); setMRegion(""); setMPhone(""); setMHireDate(""); setMSalary(""); setMCommType(""); setMCommRate(""); setMTarget("");
    }, 1400);
  };

  const handleCommissionPayout = () => {
    if (!payoutMethod) return;
    setCommissionDone(true);
    setTimeout(() => {
      setCommissionDone(false); setCommissionOpen(false);
      setPayoutMethod("");
    }, 1400);
  };

  // ── Marketing Report ──
  const handleGenerateReport = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };
  const handleDownloadPDF = () => {
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = repDateMode === "all" ? t("كل الفترة", "All Period") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;
    const fmtCurrency2 = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
    const totalCommission = marketers.reduce((s, m) => s + ((m as any).totalCommission ?? m.commission ?? 0), 0);
    const totalPaid = marketers.reduce((s, m) => s + ((m as any).paidCommission ?? 0), 0);
    const totalPending = totalCommission - totalPaid;
    const topMarketers = [...marketers].sort((a, b) => ((b as any).totalCommission ?? b.commission ?? 0) - ((a as any).totalCommission ?? a.commission ?? 0));

    const styles = `
      @page{size:A4 portrait;margin:15mm 18mm}
      body{font-family:'Segoe UI',Tahoma,sans-serif;direction:rtl;color:#1e293b;line-height:1.7;font-size:12px}
      .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:120px;font-weight:900;color:rgba(37,99,235,.04);pointer-events:none;z-index:-1;letter-spacing:8px;white-space:nowrap}
      .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:22px;gap:20px}
      .header-right{text-align:right}.header-left{text-align:left;color:#64748b;font-size:11px;line-height:1.5}
      .header h1{font-size:20px;margin:0 0 2px;color:#1d4ed8;font-weight:800}
      .header .sub{font-size:12px;color:#64748b;margin:0}
      .header .company{font-size:13px;font-weight:700;color:#1e293b}
      .meta{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:20px;padding:8px 12px;background:#f8fafc;border-radius:6px}
      .section{margin-bottom:20px}
      .section h2{font-size:14px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:0 0 10px;color:#1d4ed8;font-weight:700;display:flex;align-items:center;gap:6px}
      .section h2:before{content:'';display:inline-block;width:4px;height:16px;background:#1d4ed8;border-radius:2px}
      .grid{display:flex;gap:8px;flex-wrap:wrap}
      .card{flex:1;min-width:90px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 8px;text-align:center;background:#fff}
      .card .num{font-size:18px;font-weight:800}.card .lbl{font-size:10px;color:#64748b;margin-top:2px}
      .num-blue{color:#1d4ed8}.num-green{color:#15803d}.num-red{color:#dc2626}.num-amber{color:#b45309}
      table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11px;border-radius:6px;overflow:hidden}
      th{background:#1d4ed8;color:#fff;font-weight:600;padding:7px 6px;font-size:11px}
      td{border:1px solid #e2e8f0;padding:6px}
      tr:nth-child(even){background:#f8fafc}
      .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:500}
      .badge-green{background:#dcfce7;color:#15803d}.badge-red{background:#fee2e2;color:#dc2626}.badge-amber{background:#fef3c7;color:#b45309}
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
    `;
    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right"><h1>${t("تقرير التسويق", "Marketing Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>👥 ${marketers.length} ${t("مسوق", "marketer(s)")}</span><span>💰 ${fmtCurrency2(totalCommission)}</span></div>
      ${repSummary ? `
      <div class="section"><h2>${t("ملخص التسويق", "Marketing Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${marketers.length}</div><div class="lbl">${t("إجمالي المسوقين", "Total Marketers")}</div></div>
          <div class="card"><div class="num num-blue">${fmtCurrency2(totalCommission)}</div><div class="lbl">${t("إجمالي العمولات", "Total Commission")}</div></div>
          <div class="card"><div class="num num-green">${fmtCurrency2(totalPaid)}</div><div class="lbl">${t("المدفوع", "Paid")}</div></div>
          <div class="card"><div class="num num-red">${fmtCurrency2(totalPending)}</div><div class="lbl">${t("المتبقي", "Pending")}</div></div>
        </div>
      </div>` : ""}
      ${repMarketers ? `
      <div class="section"><h2>${t("قائمة المسوقين", "Marketers List")}</h2>
        <table><tr><th>#</th><th>${t("الاسم", "Name")}</th><th>${t("الهاتف", "Phone")}</th><th>${t("إجمالي العمولات", "Total Commission")}</th><th>${t("المدفوع", "Paid")}</th><th>${t("المتبقي", "Pending")}</th></tr>
        ${marketers.map((m, i) => {
          const tot = (m as any).totalCommission ?? m.commission ?? 0;
          const paid = (m as any).paidCommission ?? 0;
          const pending = tot - paid;
          return `<tr><td>${i + 1}</td><td><strong>${m.name}</strong></td><td>${(m as any).phone || "—"}</td><td>${fmtCurrency2(tot)}</td><td style="color:#15803d">${fmtCurrency2(paid)}</td><td style="color:${pending > 0 ? "#dc2626" : "#15803d"}">${fmtCurrency2(pending)}</td></tr>`;
        }).join("")}
        </table>
      </div>` : ""}
      ${repPerformance && topMarketers.length > 0 ? `
      <div class="section"><h2>${t("أداء المسوقين", "Marketer Performance")}</h2>
        <table><tr><th>#</th><th>${t("المسوق", "Marketer")}</th><th>${t("إجمالي العمولات", "Commission")}</th><th>${t("نسبة التحصيل", "Collection Rate")}</th></tr>
        ${topMarketers.map((m, i) => {
          const tot = (m as any).totalCommission ?? m.commission ?? 0;
          const paid = (m as any).paidCommission ?? 0;
          const rate = tot > 0 ? Math.round((paid / tot) * 100) : 0;
          return `<tr><td>${i + 1}</td><td><strong>${m.name}</strong></td><td>${fmtCurrency2(tot)}</td><td style="color:${rate >= 80 ? "#15803d" : rate >= 50 ? "#b45309" : "#dc2626"};font-weight:600">${rate}%</td></tr>`;
        }).join("")}
        </table>
      </div>` : ""}
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
          <h1 className="text-3xl font-bold tracking-tight">{t("التسويق والعمولات", "Marketing")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("إدارة المناديب وعمولات المبيعات", "Manage marketers and sales commissions")}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setRepOpen(true)}>
            <BarChart3 className="w-4 h-4" />{t("تقرير", "Report")}
          </Button>
          <Button className="gap-2 w-full sm:w-auto" onClick={() => setAddOpen(true)} data-testid="button-add-marketer">
            <Plus className="w-4 h-4" />
            {t("إضافة مندوب", "Add Marketer")}
          </Button>
        </div>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        <AnimatePresence>
          {marketers.map((m) => {
            const progress = Math.min(100, Math.round((m.totalSales / m.target) * 100));
            return (
              <motion.div variants={itemVariants} key={m.id} layout>
                <Card
                  className="p-3 sm:p-6 relative overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow"
                  data-testid={`card-marketer-${m.id}`}
                  onClick={() => { setSelectedMarketer(m); setDetailOpen(true); }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 text-primary rounded-lg">
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{m.name}</h3>
                        <p className="text-xs text-muted-foreground">{m.region} — {m.customersCount} {t("عميل", "Customers")}</p>
                      </div>
                    </div>
                    {progress >= 100 && <Trophy className="w-5 h-5 text-amber-500" />}
                  </div>

                  <div className="space-y-4 mb-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{t("المبيعات:", "Sales:")}</span>
                        <span className="font-semibold">{formatCurrency(m.totalSales)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">{t("الهدف:", "Target:")}</span>
                        <span>{formatCurrency(m.target)}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-left rtl:text-right mt-1 text-muted-foreground">{progress}%</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("العمولة المستحقة", "Commission Due")}</p>
                      <p className="font-bold text-emerald-500">{formatCurrency(m.commission)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/10"
                      onClick={e => { e.stopPropagation(); setSelectedMarketer(m); setCommissionOpen(true); }}
                      data-testid={`button-pay-commission-${m.id}`}
                    >
                      <DollarSign className="w-3 h-3" />{t("صرف العمولة", "Pay Commission")}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Add Marketer Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("إضافة مندوب جديد", "Add New Marketer")}</SheetTitle>
            <SheetDescription>{t("أدخل بيانات المندوب وطريقة احتساب العمولة", "Enter marketer details and commission structure")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label>{t("الاسم", "Name")}</Label>
                <SmartInput placeholder={t("اسم المندوب", "Marketer name")} value={mName} onChange={setMName} extraSuggestions={marketers.map(m => m.name)} />
              </div>
              <div className="space-y-2">
                <Label>{t("المنطقة", "Region")}</Label>
                <Input placeholder={t("مثال: الدلتا", "e.g. Delta")} value={mRegion} onChange={e => setMRegion(e.target.value)} data-testid="input-marketer-region" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label>{t("رقم الهاتف", "Phone")}</Label>
                <Input dir="ltr" placeholder="0100 000 0000" value={mPhone} onChange={e => setMPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("تاريخ التوظيف", "Hire Date")}</Label>
                <Input type="date" value={mHireDate} onChange={e => setMHireDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("الراتب الشهري (ج.م)", "Monthly Salary (EGP)")}</Label>
              <Input type="number" min="0" placeholder="0" value={mSalary} onChange={e => setMSalary(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("نوع العمولة", "Commission Type")}</Label>
              <Select value={mCommType} onValueChange={setMCommType}>
                <SelectTrigger data-testid="select-commission-type"><SelectValue placeholder={t("اختر نوع العمولة", "Select commission type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct">{t("نسبة من الفاتورة %", "% of Invoice")}</SelectItem>
                  <SelectItem value="per_ton">{t("مبلغ لكل طن", "Amount per Ton")}</SelectItem>
                  <SelectItem value="tiered">{t("نظام الشرائح", "Tiered System")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mCommType === "pct" && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <Label>{t("النسبة %", "Rate %")}</Label>
                <Input type="number" min="0" max="100" placeholder="2" value={mCommRate} onChange={e => setMCommRate(e.target.value)} data-testid="input-commission-rate-pct" />
              </motion.div>
            )}
            {mCommType === "per_ton" && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <Label>{t("المبلغ لكل طن (ج.م)", "Amount per Ton (EGP)")}</Label>
                <Input type="number" min="0" placeholder="50" value={mCommRate} onChange={e => setMCommRate(e.target.value)} data-testid="input-commission-rate-ton" />
              </motion.div>
            )}
            {mCommType === "tiered" && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                <p className="font-medium mb-2">{t("نظام الشرائح التلقائي:", "Auto Tiered System:")}</p>
                <p>0 – 100 {t("طن", "tons")} = 1%</p>
                <p>100 – 300 {t("طن", "tons")} = 2%</p>
                <p>300+ {t("طن", "tons")} = 3%</p>
              </motion.div>
            )}
            <div className="space-y-2">
              <Label>{t("الهدف الشهري (ج.م)", "Monthly Target (EGP)")}</Label>
              <Input type="number" min="0" placeholder="1000000" value={mTarget} onChange={e => setMTarget(e.target.value)} data-testid="input-marketer-target" />
            </div>
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-medium">{t("تم إضافة المندوب!", "Marketer added!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex gap-3">
                  <Button className="flex-1" onClick={handleAdd} disabled={!mName || !mRegion || !mCommType} data-testid="button-submit-marketer">
                    {t("إضافة المندوب", "Add Marketer")}
                  </Button>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* Marketer Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedMarketer && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                    {selectedMarketer.name.substring(0, 2)}
                  </div>
                  <div>
                    <SheetTitle className="text-xl">{selectedMarketer.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground mt-1">{selectedMarketer.region}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-6">
                {[
                  { icon: TrendingUp, label: t("إجمالي المبيعات", "Total Sales"), value: formatCurrency(selectedMarketer.totalSales), color: "text-primary" },
                  { icon: Target, label: t("الهدف الشهري", "Monthly Target"), value: formatCurrency(selectedMarketer.target), color: "text-foreground" },
                  { icon: DollarSign, label: t("العمولة المستحقة", "Commission Due"), value: formatCurrency(selectedMarketer.commission), color: "text-emerald-500" },
                  { icon: Users, label: t("عدد العملاء", "Customers Count"), value: `${selectedMarketer.customersCount} ${t("عميل", "clients")}`, color: "text-foreground" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <Card key={label} className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <p className={`font-bold text-sm ${color}`}>{value}</p>
                  </Card>
                ))}
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{t("تحقيق الهدف", "Target Achievement")}</span>
                  <span className="font-bold">{Math.min(100, Math.round((selectedMarketer.totalSales / selectedMarketer.target) * 100))}%</span>
                </div>
                <Progress value={Math.min(100, Math.round((selectedMarketer.totalSales / selectedMarketer.target) * 100))} className="h-3" />
              </div>

              <Button
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => { setDetailOpen(false); setCommissionOpen(true); }}
                data-testid="button-pay-commission-from-detail"
              >
                <DollarSign className="w-4 h-4" />{t("صرف العمولة", "Pay Commission")}
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Commission Payout Dialog */}
      <Sheet open={commissionOpen} onOpenChange={setCommissionOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("صرف العمولة", "Pay Commission")}</SheetTitle>
            {selectedMarketer && <SheetDescription>{selectedMarketer.name} — {formatCurrency(selectedMarketer.commission)}</SheetDescription>}
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("طريقة الصرف", "Payout Method")}</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger data-testid="select-commission-payout-method"><SelectValue placeholder={t("اختر الطريقة", "Select method")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t("إضافة للخزنة اليومية", "Add to Daily Treasury")}</SelectItem>
                  <SelectItem value="weekly">{t("صرف أسبوعي", "Weekly Payout")}</SelectItem>
                  <SelectItem value="monthly">{t("إضافة للراتب الشهري", "Add to Monthly Salary")}</SelectItem>
                  <SelectItem value="bank">{t("تحويل بنكي", "Bank Transfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedMarketer && payoutMethod && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("المبلغ المستحق للصرف:", "Amount to be paid:")}</p>
                <p className="text-2xl font-bold text-emerald-500 mt-1">{formatCurrency(selectedMarketer.commission)}</p>
              </motion.div>
            )}
            <AnimatePresence mode="wait">
              {commissionDone ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-medium">{t("تم صرف العمولة!", "Commission paid!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex gap-3">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCommissionPayout} disabled={!payoutMethod} data-testid="button-confirm-commission-payout">
                    {t("تأكيد الصرف", "Confirm Payout")}
                  </Button>
                  <Button variant="outline" onClick={() => setCommissionOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Marketing Report Dialog ── */}
      <Dialog open={repOpen} onOpenChange={v => { if (!v) { setRepOpen(false); setRepGenerated(false); setRepGenerating(false); setRepDateMode("all"); setRepDateFrom(""); setRepDateTo(""); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {t("تقرير التسويق", "Marketing Report")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Period */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("الفترة", "Period")}</Label>
              <div className="flex gap-1">
                {[
                  { id: "all" as DateMode, label: t("الكل", "All") },
                  { id: "today" as DateMode, label: t("اليوم", "Today") },
                  { id: "range" as DateMode, label: t("مدة", "Range") },
                ].map(f => (
                  <button key={f.id} type="button" onClick={() => setRepDateMode(f.id)}
                    className={`px-3 py-1.5 text-[11px] rounded-lg border transition-colors ${repDateMode === f.id ? "bg-primary/10 border-primary/30 text-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {repDateMode === "range" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("من", "From")}</Label>
                  <input type="date" value={repDateFrom} onChange={e => setRepDateFrom(e.target.value)}
                    className="w-full h-9 text-xs rounded-lg border border-input bg-transparent px-2" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("إلى", "To")}</Label>
                  <input type="date" value={repDateTo} onChange={e => setRepDateTo(e.target.value)}
                    className="w-full h-9 text-xs rounded-lg border border-input bg-transparent px-2" />
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("الأقسام", "Sections")}</Label>
              <div className="space-y-1">
                {[
                  { id: "repSummary", label: t("الملخص", "Summary"), state: repSummary, set: setRepSummary },
                  { id: "repMarketers", label: t("قائمة المسوقين", "Marketers List"), state: repMarketers, set: setRepMarketers },
                  { id: "repPerformance", label: t("أداء المسوقين", "Performance"), state: repPerformance, set: setRepPerformance },
                ].map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input type="checkbox" id={s.id} checked={s.state} onChange={() => s.set(!s.state)}
                      className="w-3.5 h-3.5 rounded border-muted-foreground/30 text-primary" />
                    <label htmlFor={s.id} className="text-xs cursor-pointer">{s.label}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate */}
            {!repGenerated && !repGenerating && (
              <Button className="w-full gap-2 rounded-xl" onClick={handleGenerateReport}
                disabled={repDateMode === "range" && !repDateFrom && !repDateTo}>
                <BarChart3 className="w-4 h-4" />{t("إنشاء التقرير", "Generate Report")}
              </Button>
            )}

            {/* Generating */}
            {repGenerating && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t("جاري إنشاء التقرير...", "Generating report...")}</span>
              </div>
            )}

            {/* Generated */}
            {repGenerated && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-500 font-medium text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{t("تم إنشاء التقرير!", "Report generated!")}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Button className="w-full gap-2 rounded-xl" onClick={handleDownloadPDF}>
                    <Download className="w-4 h-4" />{t("تحميل PDF", "Download PDF")}
                  </Button>
                  <Button variant="outline" className="w-full gap-2 rounded-xl" onClick={() => { setRepOpen(false); setRepGenerated(false); setRepGenerating(false); }}>
                    {t("إغلاق", "Close")}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
