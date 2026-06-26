import React, { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useHRStore, calcDailyRate, daysInMonth, type Employee, type PayrollTransaction, type AttendanceStatus, type SalaryType } from "@/hooks/use-hr-store";
import { useSalesStore } from "@/hooks/use-sales-store";
import { usePermission } from "@/hooks/use-permission";
import { fmtDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SmartInput from "@/components/SmartInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { DollarSign, CheckCircle2, CalendarDays, UserCheck, UserX, History, Banknote, FileText, Search, Gift, Settings, Filter, Calendar, Phone, BarChart3, Download } from "lucide-react";

const WEEKDAY_NAMES = [
  { ar: "الأحد", en: "Sun" },
  { ar: "الإثنين", en: "Mon" },
  { ar: "الثلاثاء", en: "Tue" },
  { ar: "الأربعاء", en: "Wed" },
  { ar: "الخميس", en: "Thu" },
  { ar: "الجمعة", en: "Fri" },
  { ar: "السبت", en: "Sat" },
];

const MONTH_NAMES = [
  "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const SALARY_LABELS: Record<SalaryType, { ar: string; en: string }> = {
  monthly: { ar: "شهري", en: "Monthly" },
  weekly: { ar: "أسبوعي", en: "Weekly" },
};

const fmtCurrency = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const cairoDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));

const fmtCairoDate = (d: Date) =>
  d.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

type SectionTab = "all" | "monthly" | "weekly" | "incentive" | "commission";

export default function Payroll() {
  const { t, payrollMonthlyReleaseDay, payrollMonthlyAdvanceDays, payrollWeeklyReleaseDay, payrollWeeklyAdvanceDays, payrollWeekStartDay, payrollMonthStartDay } = useAppStore();
  const { employees, attendance, incentiveApproved, attendanceDeductions, checkIn, checkOut, setAttendance, setIncentiveApproved, computePendingIncentive, computeEmployeePayroll, computeWeekPayroll, computeOvertime, approveDailyIncentive, approveMonthlySalary, approveWeeklySalary, payrollTransactions, computePendingCommission, approveMarketerCommission, commissionApproved } = useHRStore();
  const salesInvoices = useSalesStore((s) => s.invoices);
  const { can } = usePermission();

  const todayCairo = cairoDate();
  const todayStr = todayCairo.toISOString().split("T")[0];
  const [viewDateStr, setViewDateStr] = useState(todayStr);
  const viewDate = new Date(viewDateStr + "T00:00:00");

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const viewDay = viewDate.getDate();
  const viewDayOfWeek = viewDate.getDay();
  const totalMonthDays = daysInMonth(year, month);

  const [searchQ, setSearchQ] = useState("");
  const [sectionTab, setSectionTab] = useState<SectionTab>("all");

  const [dailyEmp, setDailyEmp] = useState<Employee | null>(null);
  const [dailyOpen, setDailyOpen] = useState(false);

  const [approveEmpOpen, setApproveEmpOpen] = useState(false);
  const [approveEmp, setApproveEmp] = useState<Employee | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [approveAction, setApproveAction] = useState<"idle" | "approving" | "done">("idle");
  const [approveDoneLabel, setApproveDoneLabel] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<PayrollTransaction | null>(null);
  const [incApprovingId, setIncApprovingId] = useState<string | null>(null);

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repSummary, setRepSummary] = useState(true);
  const [repDetails, setRepDetails] = useState(true);
  const [repDeductions, setRepDeductions] = useState(true);
  const [repSearch, setRepSearch] = useState("");

  // Group employees by category
  const allEmps = useMemo(() => employees, [employees]);
  const monthlyEmps = useMemo(() => employees.filter(e => e.salaryType === "monthly"), [employees]);
  const weeklyEmps = useMemo(() => employees.filter(e => e.salaryType === "weekly"), [employees]);
  const incentiveEmps = useMemo(() => employees.filter(e => e.dailyIncentive > 0), [employees]);
  const commissionEmps = useMemo(() => employees.filter(e => e.commissionType !== "none" && e.commissionRate > 0), [employees]);

  const getWeekBounds = useCallback((yr: number, mo: number, wn: number, wsd: number) => {
    const total = daysInMonth(yr, mo);
    const firstDow = new Date(yr, mo - 1, 1).getDay();
    const firstStart = firstDow === wsd ? 1 : ((wsd - firstDow + 7) % 7) + 1;
    const start = Math.max(firstStart + (wn - 1) * 7, 1);
    const end = Math.min(start + 6, total);
    return { startDay: start, endDay: end };
  }, []);

  const viewWeekNumber = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const firstStart = firstDow === payrollWeekStartDay ? 1 : ((payrollWeekStartDay - firstDow + 7) % 7) + 1;
    if (viewDay < firstStart) return 1;
    return Math.min(5, Math.floor((viewDay - firstStart) / 7) + 1);
  }, [viewDay, year, month, payrollWeekStartDay]);

  const cairoTodayDate = useMemo(() => cairoDate(), []);
  const cairoTodayDay = cairoTodayDate.getDate();
  const defaultWeekNumber = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const firstStart = firstDow === payrollWeekStartDay ? 1 : ((payrollWeekStartDay - firstDow + 7) % 7) + 1;
    if (cairoTodayDay < firstStart) return 1;
    return Math.min(5, Math.floor((cairoTodayDay - firstStart) / 7) + 1);
  }, [cairoTodayDay, year, month, payrollWeekStartDay]);

  const availableWeeks = useMemo(() => {
    const total = daysInMonth(year, month);
    const firstDow = new Date(year, month - 1, 1).getDay();
    const firstStart = firstDow === payrollWeekStartDay ? 1 : ((payrollWeekStartDay - firstDow + 7) % 7) + 1;
    const weeks: number[] = [];
    for (let w = 1; w <= 5; w++) {
      const start = firstStart + (w - 1) * 7;
      if (start <= total) weeks.push(w);
    }
    return weeks;
  }, [year, month, payrollWeekStartDay]);

  // Search filter
  const filterFn = (emp: Employee) => {
    if (!searchQ.trim()) return true;
    const q = searchQ.trim().toLowerCase();
    return emp.name.toLowerCase().includes(q) || emp.phone.includes(q);
  };

  // Release status helpers
  const wasPaidThisMonth = (empId: string) =>
    payrollTransactions.some(tx => tx.breakdown.some(b => b.employeeId === empId) && tx.year === year && tx.month === month && tx.approvalType !== "incentive");

  const wasIncentivePaidThisMonth = (empId: string) =>
    payrollTransactions.some(tx => tx.breakdown.some(b => b.employeeId === empId) && tx.year === year && tx.month === month && tx.approvalType === "incentive");

  const monthlyReleaseStatus = (empId: string): { label: string; color: string; canApprove: boolean } => {
    if (wasPaidThisMonth(empId)) return { label: t("تم الصرف", "Paid"), color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", canApprove: false };
    const cutoff = payrollMonthlyReleaseDay;
    const advanceStart = cutoff - payrollMonthlyAdvanceDays;
    if (viewDay >= advanceStart && viewDay < cutoff) return { label: t("مستحق للاعتماد", "Pending Approval"), color: "text-amber-500 bg-amber-500/10 border-amber-500/20", canApprove: true };
    if (viewDay >= cutoff) return { label: t(`متأخر (يوم ${cutoff})`, `Due (${cutoff}th)`), color: "text-red-500 bg-red-500/10 border-red-500/20", canApprove: true };
    const daysLeft = cutoff - viewDay;
    return { label: t(`سيصرف بعد ${daysLeft} أيام`, `In ${daysLeft} days`), color: "text-muted-foreground bg-muted/30 border-border", canApprove: false };
  };

  const weeklyReleaseStatus = (empId: string): { label: string; color: string; canApprove: boolean } => {
    if (wasPaidThisMonth(empId)) return { label: t("تم الصرف", "Paid"), color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", canApprove: false };
    const wb = getWeekBounds(year, month, viewWeekNumber, payrollWeekStartDay);
    const weekStartDay = wb.startDay;
    const weekEndDay = wb.endDay;
    if (weekStartDay > weekEndDay) return { label: t("الأسبوع القادم", "Next week"), color: "text-muted-foreground bg-muted/30 border-border", canApprove: false };
    const releaseDayOfWeek = payrollWeeklyReleaseDay;
    const advanceDays = payrollWeeklyAdvanceDays;
    const thisWeekStartDate = new Date(year, month - 1, weekStartDay);
    const releaseDate = new Date(thisWeekStartDate);
    const diffToRelease = (releaseDayOfWeek - thisWeekStartDate.getDay() + 7) % 7;
    releaseDate.setDate(thisWeekStartDate.getDate() + diffToRelease);
    if (releaseDate.getMonth() !== month - 1 || releaseDate.getDate() > weekEndDay) return { label: t("الأسبوع القادم", "Next week"), color: "text-muted-foreground bg-muted/30 border-border", canApprove: false };
    const advanceDate = new Date(releaseDate);
    advanceDate.setDate(releaseDate.getDate() - advanceDays);
    if (viewDate >= advanceDate && viewDate < releaseDate) return { label: t("مستحق للاعتماد", "Pending"), color: "text-amber-500 bg-amber-500/10 border-amber-500/20", canApprove: true };
    if (viewDate >= releaseDate) return { label: t("متأخر للصرف", "Due"), color: "text-red-500 bg-red-500/10 border-red-500/20", canApprove: true };
    return { label: t(`سيصرف ${releaseDate.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}`, `Releases ${releaseDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`), color: "text-muted-foreground bg-muted/30 border-border", canApprove: false };
  };

  // Payroll for a single employee up to view date
  const computePayrollToDate = (emp: Employee) => {
    const dr = calcDailyRate(emp);
    const joinDate = emp.joinDate ? new Date(emp.joinDate) : null;
    const joinBased = joinDate && joinDate.getFullYear() === year && joinDate.getMonth() + 1 === month ? joinDate.getDate() : 1;
    let startDay: number, endDay: number, periodLen: number;
    if (emp.salaryType === "weekly") {
      const wb = getWeekBounds(year, month, viewWeekNumber, payrollWeekStartDay);
      startDay = Math.max(wb.startDay, joinBased);
      endDay = Math.min(viewDay, wb.endDay);
      periodLen = 7;
    } else {
      startDay = Math.max(joinBased, payrollMonthStartDay);
      endDay = Math.min(viewDay, totalMonthDays);
      periodLen = 30;
    }
    let present = 0, absent = 0, late = 0, deduction = 0;
    let totalPay = 0;
    for (let d = startDay; d <= endDay; d++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const a = attendance[emp.id]?.[date] ?? "present";
      const dedAmt = attendanceDeductions?.[emp.id]?.[date];
      const lpct = emp.lateDeductionPct ?? 0;
      if (a === "present") { present++; totalPay += dr; }
      else if (a === "absent") { absent++; }
      else if (a === "late") { late++; totalPay += dr * (1 - lpct / 100); }
      else if (a === "deduction") { deduction++; totalPay += Math.max(0, dr - (dedAmt || 0)); }
      else { present++; totalPay += dr; }
      const ot = computeOvertime(emp, date);
      if (ot.pay > 0) totalPay += ot.pay;
    }
    return { dailyRate: dr, presentDays: present, absentDays: absent, lateDays: late, deductionDays: deduction, grossBase: totalPay, periodLength: periodLen };
  };

  const pendingInc = (empId: string) => computePendingIncentive(empId);

  const handleOpenApprove = (emp: Employee) => {
    setApproveEmp(emp);
    setWeekNumber(defaultWeekNumber);
    setApproveAction("idle");
    setApproveEmpOpen(true);
  };

  const handleOpenDaily = (emp: Employee) => {
    setDailyEmp(emp);
    setDailyOpen(true);
  };

  const handleToggleDay = (empId: string, date: string) => {
    const current = attendance[empId]?.[date] ?? "present";
    setAttendance(empId, date, current === "present" ? "absent" : "present");
  };

  const handleToggleIncentive = (empId: string, date: string) => {
    const current = incentiveApproved[empId]?.[date] ?? true;
    setIncentiveApproved(empId, date, !current);
  };

  const handleApproveIncentiveOnly = (emp: Employee) => {
    setIncApprovingId(emp.id);
    setTimeout(() => {
      try {
        approveDailyIncentive(emp.id, year, month);
      } catch (e) {
        console.error("Approve incentive error:", e);
      }
      setIncApprovingId(null);
    }, 800);
  };

  const handleApproveIncentive = () => {
    if (!approveEmp) return;
    setApproveAction("approving");
    setTimeout(() => {
      approveDailyIncentive(approveEmp.id, year, month);
      setApproveDoneLabel(t("تم اعتماد الحافز!", "Incentive approved!"));
      setApproveAction("done");
    }, 1200);
  };

  const handleApproveMonthly = () => {
    if (!approveEmp) return;
    setApproveAction("approving");
    setTimeout(() => {
      approveMonthlySalary(approveEmp.id, year, month, payrollMonthStartDay, viewDay);
      setApproveDoneLabel(t("تم اعتماد الراتب الشهري!", "Monthly salary approved!"));
      setApproveAction("done");
    }, 1200);
  };

  const handleApproveWeekly = () => {
    if (!approveEmp) return;
    setApproveAction("approving");
    setTimeout(() => {
      approveWeeklySalary(approveEmp.id, year, month, weekNumber, payrollWeekStartDay, viewDay);
      setApproveDoneLabel(t("تم اعتماد الراتب الأسبوعي!", "Weekly salary approved!"));
      setApproveAction("done");
    }, 1200);
  };

  // Employee card renderer
  const renderEmployeeCard = (emp: Employee) => {
    const { dailyRate, presentDays, grossBase, periodLength } = computePayrollToDate(emp);
    const pi = pendingInc(emp.id);
    const status = emp.salaryType === "weekly" ? weeklyReleaseStatus(emp.id) : monthlyReleaseStatus(emp.id);
    return (
      <motion.div key={emp.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="p-3 sm:p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-all">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base flex-shrink-0">
              {emp.name.substring(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{emp.name}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                <Phone className="w-3 h-3 shrink-0" />{emp.phone || "—"} · {emp.position} · {emp.department}
              </p>
            </div>
          </div>
          <Badge className={`text-[10px] whitespace-nowrap shrink-0 ${status.color}`} variant="outline">
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
          <div className="p-2 bg-muted/20 rounded-lg">
            <p className="text-[9px] text-muted-foreground">{t("اليومي", "Daily")}</p>
            <p className="text-sm font-bold text-primary">{fmtCurrency(dailyRate)}</p>
          </div>
          {emp.dailyIncentive > 0 && (
            <div className="p-2 bg-muted/20 rounded-lg">
              <p className="text-[9px] text-muted-foreground">{t("الحافز", "Inc.")}</p>
              <p className="text-sm font-bold text-emerald-500">{fmtCurrency(emp.dailyIncentive)}</p>
            </div>
          )}
          <div className="p-2 bg-muted/20 rounded-lg">
            <p className="text-[9px] text-muted-foreground">{t("أيام", "Days")}</p>
                            <p className="text-sm font-bold">{presentDays}/{periodLength}</p>
          </div>
          <div className="p-2 bg-muted/20 rounded-lg">
            <p className="text-[9px] text-muted-foreground">{t("المستحق", "Earned")}</p>
            <p className="text-sm font-bold text-primary">{fmtCurrency(grossBase)}</p>
          </div>
          {pi > 0 && (
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <p className="text-[9px] text-muted-foreground">{t("مرحّل", "Pending")}</p>
              <p className="text-sm font-bold text-amber-500">{fmtCurrency(pi)}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleOpenDaily(emp)}>
            <CalendarDays className="w-3 h-3" />{t("الحضور", "Attendance")}
          </Button>
          {status.canApprove && (
            <Button size="sm" className={`h-7 text-xs gap-1 ${status.label.includes("متأخر") || status.label.includes("Due") ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"} text-white`}
              onClick={() => handleOpenApprove(emp)}>
              <CheckCircle2 className="w-3 h-3" />
              {emp.salaryType === "weekly" ? t("اعتماد الأسبوعي", "Approve Week") : t("اعتماد الشهر", "Approve Month")}
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  const SectionEmpty = ({ msg }: { msg: string }) => (
    <div className="py-10 text-center text-muted-foreground">
      <p className="text-sm">{msg}</p>
    </div>
  );

  // ── Payroll Report ──
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
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth() + 1;
    
    const rptEmps = employees.filter(e => !repSearch || e.name.includes(repSearch));
    const activeEmps = rptEmps.filter(e => e.status === "active");
    
    const rptTransactions = payrollTransactions.filter(tx => {
      if (repDateMode === "today") {
        if (tx.year !== todayY || tx.month !== todayM) return false;
      }
      if (repDateMode === "range") {
        if (repDateFrom) {
          const [fy, fm] = repDateFrom.split("-").map(Number);
          if (tx.year < fy || (tx.year === fy && tx.month < fm)) return false;
        }
        if (repDateTo) {
          const [ty, tm] = repDateTo.split("-").map(Number);
          if (tx.year > ty || (tx.year === ty && tx.month > tm)) return false;
        }
      }
      return true;
    });
    
    const deductionEntries: { employeeId: string; reason: string; amount: number }[] = [];
    Object.entries(attendanceDeductions).forEach(([empId, dates]) => {
      Object.entries(dates).forEach(([date, amt]) => {
        const emp = employees.find(e => e.id === empId);
        deductionEntries.push({ employeeId: emp?.name || empId, reason: date, amount: amt });
      });
    });
    
    const totalSalary = rptTransactions.reduce((s, t) => s + (t.totalGross || 0), 0);
    const totalPaid = rptTransactions.filter(t => t.approvalType !== "incentive").reduce((s, t) => s + (t.totalGross || 0), 0);
    const totalPending = rptTransactions.filter(t => t.approvalType === "incentive").reduce((s, t) => s + (t.totalGross || 0), 0);
    
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
        <div class="header-right"><h1>${t("تقرير الرواتب", "Payroll Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>👥 ${activeEmps.length} ${t("موظف", "employee(s)")}</span><span>💰 ${fmtCurrency2(totalSalary)}</span></div>
      ${repSummary ? `
      <div class="section"><h2>${t("ملخص الرواتب", "Payroll Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${activeEmps.length}</div><div class="lbl">${t("الموظفين النشطين", "Active Employees")}</div></div>
          <div class="card"><div class="num num-blue">${fmtCurrency2(totalSalary)}</div><div class="lbl">${t("إجمالي الرواتب", "Total Salary")}</div></div>
          <div class="card"><div class="num num-green">${fmtCurrency2(totalPaid)}</div><div class="lbl">${t("المدفوع", "Paid")}</div></div>
          <div class="card"><div class="num num-amber">${fmtCurrency2(totalPending)}</div><div class="lbl">${t("المعلق", "Pending")}</div></div>
        </div>
      </div>` : ""}
      ${repDetails && activeEmps.length > 0 ? `
      <div class="section"><h2>${t("تفاصيل الرواتب", "Salary Details")}</h2>
        <table><tr><th>#</th><th>${t("الموظف", "Employee")}</th><th>${t("القسم", "Department")}</th><th>${t("الراتب الأساسي", "Base Salary")}</th><th>${t("الحالة", "Status")}</th></tr>
        ${activeEmps.map((e, i) => {
          const st = e.status === "active" ? `<span class="badge badge-green">${t("نشط","Active")}</span>` : `<span class="badge badge-red">${t("غير نشط","Inactive")}</span>`;
          return `<tr><td>${i + 1}</td><td><strong>${e.name}</strong></td><td>${e.department || "—"}</td><td>${fmtCurrency2(e.baseSalary || 0)}</td><td>${st}</td></tr>`;
        }).join("")}
        </table>
      </div>` : ""}
      ${repDeductions && deductionEntries.length > 0 ? `
      <div class="section"><h2>${t("الخصومات", "Deductions")} (${deductionEntries.length})</h2>
        <table><tr><th>#</th><th>${t("الموظف", "Employee")}</th><th>${t("التاريخ", "Date")}</th><th>${t("المبلغ", "Amount")}</th></tr>
        ${deductionEntries.map((d, i) => `<tr><td>${i + 1}</td><td><strong>${d.employeeId || "—"}</strong></td><td>${d.reason || "—"}</td><td style="color:#dc2626;font-weight:600">${fmtCurrency2(d.amount || 0)}</td></tr>`).join("")}
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
    <div className="space-y-3 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("الرواتب", "Payroll")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{fmtCairoDate(cairoDate())}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs" onClick={() => setHistoryOpen(true)}>
            <History className="w-3.5 h-3.5" />{t("السجل", "History")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs" onClick={() => setRepOpen(true)}>
            <BarChart3 className="w-3.5 h-3.5" />{t("تقرير", "Report")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs" asChild>
            <a href="/settings">{/* In-page nav */}<Settings className="w-3.5 h-3.5" />{t("الإعدادات", "Settings")}</a>
          </Button>
        </div>
      </div>

      {/* Date + Search bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 min-w-[200px]">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={viewDateStr} onChange={e => setViewDateStr(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1" />
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <SmartInput placeholder={t("ابحث باسم أو تليفون...", "Search by name or phone...")} value={searchQ} onChange={setSearchQ}
              className="bg-transparent text-sm outline-none border-0 p-0 shadow-none focus-visible:ring-0 w-full" extraSuggestions={employees.map(e => e.name)} showSuggestion={false} />
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {MONTH_NAMES[month]} {year} — {t("حتى يوم", "up to day")} {viewDay}
        </span>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { id: "all" as SectionTab, label: t("الكل", "All"), count: allEmps.length },
          { id: "monthly" as SectionTab, label: t("شهري", "Monthly"), count: monthlyEmps.length },
          { id: "weekly" as SectionTab, label: t("أسبوعي", "Weekly"), count: weeklyEmps.length },
          { id: "incentive" as SectionTab, label: t("الحافز اليومي", "Daily Incentive"), count: incentiveEmps.length, color: "text-amber-500 border-amber-500/30" },
          { id: "commission" as SectionTab, label: t("العمولات", "Commissions"), count: commissionEmps.length, color: "text-purple-500 border-purple-500/30" },
        ]).map(s => (
          <button key={s.id} onClick={() => setSectionTab(s.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              sectionTab === s.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : `bg-card border ${s.color || "border-border"} text-muted-foreground hover:text-foreground hover:border-primary/30`
            }`}>
            {s.label} <span className={`text-[10px] ${sectionTab === s.id ? "opacity-80" : "text-muted-foreground"}`}>({s.count})</span>
          </button>
        ))}
      </div>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        <motion.div key={sectionTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
          {sectionTab === "all" && (
            <>
              <p className="text-sm text-muted-foreground">
                {t("جميع الموظفين", "All employees")}
              </p>
              {allEmps.filter(filterFn).length === 0
                ? <SectionEmpty msg={t("لا يوجد موظفون", "No employees")} />
                : allEmps.filter(filterFn).map(renderEmployeeCard)}
            </>
          )}
          {sectionTab === "monthly" && (
            <>
              <p className="text-sm text-muted-foreground">
                {t("موظفون براتب شهري", "Monthly salary employees")}
              </p>
              {monthlyEmps.filter(filterFn).length === 0
                ? <SectionEmpty msg={t("لا يوجد موظفون شهري", "No monthly employees")} />
                : monthlyEmps.filter(filterFn).map(renderEmployeeCard)}
            </>
          )}
          {sectionTab === "weekly" && (
            <>
              <p className="text-sm text-muted-foreground">
                {t("موظفون براتب أسبوعي — الأسبوع", "Weekly salary employees — Week")} {viewWeekNumber}
              </p>
              {weeklyEmps.filter(filterFn).length === 0
                ? <SectionEmpty msg={t("لا يوجد موظفون أسبوعي", "No weekly employees")} />
                : weeklyEmps.filter(filterFn).map(renderEmployeeCard)}
            </>
          )}
          {sectionTab === "incentive" && (
            <>
              <p className="text-sm text-amber-500">
                {t("جميع الموظفين بحافز يومي — الحافز غير المعتمد يترحل تلقائياً لليوم التالي", "All employees with daily incentive — unapproved incentive auto-carries over")}
              </p>
              {incentiveEmps.filter(filterFn).length === 0
                ? <SectionEmpty msg={t("لا يوجد موظفون بحافز يومي", "No employees with daily incentive")} />
                : incentiveEmps.filter(filterFn).map(emp => {
                    const pi = pendingInc(emp.id);
                    const { presentDays, periodLength } = computePayrollToDate(emp);
                    return (
                      <motion.div key={emp.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="p-3 sm:p-4 bg-card border border-amber-500/20 rounded-xl hover:border-amber-500/40 transition-all">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-base flex-shrink-0">
                              {emp.name.substring(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{emp.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{emp.position} · {emp.department}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10 shrink-0">
                            {t("حافز", "Inc.")} {fmtCurrency(emp.dailyIncentive)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 text-center">
                          <div className="p-2 bg-muted/20 rounded-lg">
                            <p className="text-[9px] text-muted-foreground">{t("أيام الحضور", "Present")}</p>
            <p className="text-sm font-bold">{presentDays}/{periodLength}</p>
                          </div>
                          <div className="p-2 bg-amber-500/10 rounded-lg">
                            <p className="text-[9px] text-amber-600">{t("مرحّل للغد", "Carried Over")}</p>
                            <p className="text-sm font-bold text-amber-500">{fmtCurrency(pi)}</p>
                          </div>
                          <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <p className="text-[9px] text-emerald-600">{t("المجموع التراكمي", "Cumulative")}</p>
                            <p className="text-sm font-bold text-emerald-500">{fmtCurrency(pi + (presentDays * emp.dailyIncentive))}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleOpenDaily(emp)}>
                            <CalendarDays className="w-3 h-3" />{t("سجل الحضور", "Attendance Log")}
                          </Button>
                          <Button size="sm" className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => handleApproveIncentiveOnly(emp)}
                            disabled={incApprovingId === emp.id || pendingInc(emp.id) <= 0}>
                            {incApprovingId === emp.id ? (
                              <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t("جاري...", "...")}</span>
                            ) : (
                              <><CheckCircle2 className="w-3 h-3" />{t("اعتماد الحافز فقط", "Approve Only")}</>
                            )}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
            </>
          )}
          {sectionTab === "commission" && (
            <>
              <p className="text-sm text-purple-500">
                {t("عمولات مندوبي التسويق — تحتاج إلى اعتماد قبل الصرف", "Marketer commissions — pending approval")}
              </p>
              {commissionEmps.filter(filterFn).length === 0
                ? <SectionEmpty msg={t("لا يوجد موظفون بعمولات", "No employees with commissions")} />
                : commissionEmps.filter(filterFn).map(emp => {
                    const pendingComm = computePendingCommission(emp.id, salesInvoices);
                    return (
                      <motion.div key={emp.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="p-3 sm:p-4 bg-card border border-purple-500/20 rounded-xl hover:border-purple-500/40 transition-all">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-base flex-shrink-0">
                              {emp.name.substring(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{emp.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{emp.position} · {emp.department}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-purple-500 border-purple-500/30 bg-purple-500/10 shrink-0">
                            {emp.commissionType === "pct" ? `${emp.commissionRate}%` : emp.commissionType === "per_ton" ? `${fmtCurrency(emp.commissionRate)}/ط` : t("عمولة", "Comm.")}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
                          <div className="p-2 bg-purple-500/10 rounded-lg">
                            <p className="text-[9px] text-purple-600">{t("العمولة المعلقة", "Pending Comm.")}</p>
                            <p className="text-sm font-bold text-purple-500">{fmtCurrency(pendingComm)}</p>
                          </div>
                          <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <p className="text-[9px] text-emerald-600">{t("عدد الفواتير", "Invoices")}</p>
                            <p className="text-sm font-bold text-emerald-500">
                              {salesInvoices.filter(i => i.marketerId === emp.id && !commissionApproved?.[emp.id]?.[i.id]).length}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="h-7 text-xs gap-1 bg-purple-500 hover:bg-purple-600 text-white"
                            onClick={() => {
                              try {
                                approveMarketerCommission(emp.id, year, month, salesInvoices);
                                toast.success(t("تم اعتماد العمولة", "Commission approved"));
                              } catch (e) {
                                toast.error(t("لا توجد عمولة معلقة", "No pending commission"));
                              }
                            }}
                            disabled={pendingComm <= 0 || !can("payroll.approve_commission")}
                            title={!can("payroll.approve_commission") ? t("لا تملك صلاحية اعتماد العمولات", "No permission to approve commissions") : ""}>
                            <CheckCircle2 className="w-3 h-3" />{t("اعتماد العمولة", "Approve Commission")}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Daily Attendance Sheet ── */}
      <Sheet open={dailyOpen} onOpenChange={setDailyOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{dailyEmp?.name}</SheetTitle>
            <SheetDescription>{t("الحضور اليومي لشهر", "Daily attendance for")} {MONTH_NAMES[month]} {year}</SheetDescription>
          </SheetHeader>
          {dailyEmp && (() => {
            const dr = calcDailyRate(dailyEmp);
            const days: { date: string; day: number; status: AttendanceStatus; incApproved: boolean; earned: number }[] = [];
            for (let d = 1; d <= Math.min(viewDay, totalMonthDays); d++) {
              const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const status = attendance[dailyEmp.id]?.[date] ?? "present";
              const incApproved = incentiveApproved[dailyEmp.id]?.[date] ?? true;
              const earned = status === "present" ? dr + (incApproved ? dailyEmp.dailyIncentive : 0) : 0;
              days.push({ date, day: d, status, incApproved, earned });
            }
            const totalEarned = days.reduce((s, d) => s + d.earned, 0);
            return (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground bg-muted/30 rounded-lg mb-2">
                  <span>{t("اليوم", "Day")}</span>
                  <span>{t("الحضور", "Att.")}</span>
                  {dailyEmp.dailyIncentive > 0 && <span>{t("الحافز", "Inc.")}</span>}
                  <span>{t("المستحق", "Earned")}</span>
                </div>
                <ScrollArea className="h-[450px]">
                  {days.map(d => (
                    <div key={d.date}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${d.status === "present" ? "bg-emerald-500/5" : "bg-destructive/5"}`}>
                      <span className="text-sm font-medium">{d.day}</span>
                      <button onClick={() => handleToggleDay(dailyEmp.id, d.date)}
                        className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          d.status === "present" ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25" : "bg-destructive/15 text-destructive hover:bg-destructive/25"
                        }`}>
                        {d.status === "present" ? t("حاضر", "Pr.") : t("غائب", "Ab.")}
                      </button>
                      {dailyEmp.dailyIncentive > 0 ? (
                        <button onClick={() => handleToggleIncentive(dailyEmp.id, d.date)}
                          className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            d.incApproved ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25" : "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                          }`}>
                          {d.incApproved ? t("تم", "Paid") : t("مرحّل", "Carry")}
                        </button>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                      <span className={`text-sm font-bold ${d.earned > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {d.earned > 0 ? fmtCurrency(d.earned) : "—"}
                      </span>
                    </div>
                  ))}
                </ScrollArea>
                <div className="flex items-center justify-between px-3 py-3 mt-4 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">{t("إجمالي المستحق", "Total Earned")}</span>
                  <span className="text-lg font-bold text-primary">{fmtCurrency(totalEarned)}</span>
                </div>
                {computePendingIncentive(dailyEmp.id) > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 rounded-lg text-sm">
                    <span className="text-amber-600 font-medium">{t("حافز مرحّل", "Carried-over")}</span>
                    <span className="font-bold text-amber-500">{fmtCurrency(computePendingIncentive(dailyEmp.id))}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── Employee Approval Sheet ── */}
      <Sheet open={approveEmpOpen} onOpenChange={v => { if (approveAction !== "approving") setApproveEmpOpen(v); }}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{approveEmp?.name}</SheetTitle>
            <SheetDescription>{approveEmp?.position} — {approveEmp?.department}</SheetDescription>
          </SheetHeader>
          {approveEmp && approveAction === "idle" && (
            <div className="space-y-5">
              {/* Incentive card */}
              {approveEmp.dailyIncentive > 0 && pendingInc(approveEmp.id) > 0 && (
                <Card className="p-3 sm:p-4 border-l-4 border-l-amber-500">
                  <div className="flex items-center gap-2 mb-3">
                    <Gift className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold">{t("الحافز اليومي", "Daily Incentive")}</h3>
                  </div>
                  <div className="flex justify-between items-center mb-3 text-sm">
                    <span className="text-muted-foreground">{t("حافز مرحّل", "Carried-over")}</span>
                    <span className="font-bold text-amber-500 text-lg">{fmtCurrency(pendingInc(approveEmp.id))}</span>
                  </div>
                  <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600" onClick={handleApproveIncentive}>
                    <CheckCircle2 className="w-4 h-4" />{t("اعتماد الحافز", "Approve Incentive")}
                  </Button>
                </Card>
              )}
              {approveEmp.dailyIncentive > 0 && pendingInc(approveEmp.id) <= 0 && (
                <Card className="p-3 sm:p-4 border-l-4 border-l-muted bg-muted/20">
                  <div className="flex items-center gap-2 mb-2"><Gift className="w-5 h-5 text-muted-foreground" /><h3 className="font-semibold">{t("الحافز اليومي", "Daily Incentive")}</h3></div>
                  <p className="text-xs text-muted-foreground">{t("لا يوجد حافز مرحّل", "No carried-over incentive")}</p>
                </Card>
              )}

              {/* Commission card */}
              {approveEmp.commissionType !== "none" && (() => {
                const pendingComm = computePendingCommission(approveEmp.id, salesInvoices);
                return (
                  <Card className={`p-3 sm:p-4 border-l-4 ${pendingComm > 0 ? "border-l-purple-500" : "border-l-muted"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className={`w-5 h-5 ${pendingComm > 0 ? "text-purple-500" : "text-muted-foreground"}`} />
                      <h3 className="font-semibold">{t("العمولة", "Commission")}</h3>
                      <Badge variant="outline" className="text-[10px] mr-auto text-purple-500 border-purple-500/30">
                        {approveEmp.commissionType === "pct" ? `${approveEmp.commissionRate}%` : approveEmp.commissionType === "per_ton" ? `${fmtCurrency(approveEmp.commissionRate)}/ط` : t("عمولة", "Comm.")}
                      </Badge>
                    </div>
                    {pendingComm > 0 ? (
                      <>
                        <div className="flex justify-between items-center mb-3 text-sm">
                          <span className="text-muted-foreground">{t("العمولة المعلقة", "Pending Commission")}</span>
                          <span className="font-bold text-purple-500 text-lg">{fmtCurrency(pendingComm)}</span>
                        </div>
                        <Button className="w-full gap-2 bg-purple-500 hover:bg-purple-600"
                          disabled={!can("payroll.approve_commission")}
                          title={!can("payroll.approve_commission") ? t("لا تملك صلاحية اعتماد العمولات", "No permission to approve commissions") : ""}
                          onClick={() => {
                          try {
                            approveMarketerCommission(approveEmp.id, year, month, salesInvoices);
                            toast.success(t("تم اعتماد العمولة", "Commission approved"));
                            setApproveDoneLabel(t("تم اعتماد العمولة!", "Commission approved!"));
                            setApproveAction("done");
                          } catch (e) {
                            toast.error(t("لا توجد عمولة معلقة", "No pending commission"));
                          }
                        }}>
                          <CheckCircle2 className="w-4 h-4" />{t("اعتماد العمولة", "Approve Commission")}
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("لا توجد عمولة معلقة", "No pending commission")}</p>
                    )}
                  </Card>
                );
              })()}

              {/* Salary card */}
              <Card className={`p-3 sm:p-4 border-l-4 ${approveEmp.salaryType === "weekly" ? "border-l-emerald-500" : "border-l-primary"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className={`w-5 h-5 ${approveEmp.salaryType === "weekly" ? "text-emerald-500" : "text-primary"}`} />
                  <h3 className="font-semibold">{approveEmp.salaryType === "weekly" ? t("الراتب الأسبوعي", "Weekly Salary") : t("الراتب الشهري", "Monthly Salary")}</h3>
                  <Badge variant="outline" className="text-[10px] mr-auto">{t(approveEmp.salaryType === "weekly" ? "أسبوعي" : "شهري", approveEmp.salaryType === "weekly" ? "Weekly" : "Monthly")}</Badge>
                </div>
                {(() => {
                  const approvePendingInc = pendingInc(approveEmp.id);
                  if (approveEmp.salaryType === "weekly") {
                    const wp = computeWeekPayroll(approveEmp, year, month, weekNumber, payrollWeekStartDay, viewDay);
                    const grossWithInc = wp.grossPay + approvePendingInc;
                    const net = Math.max(0, grossWithInc - approveEmp.advances - approveEmp.deductions);
                    return (
                      <div className="space-y-2 text-sm">
                        <div><Label className="text-xs">{t("اختر الأسبوع", "Select Week")}</Label>
                          <Select value={String(weekNumber)} onValueChange={v => setWeekNumber(parseInt(v))}>
                            <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {availableWeeks.map(w => (
                                <SelectItem key={w} value={String(w)}>{t(`الأسبوع ${w}`, `Week ${w}`)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("السعر اليومي", "Daily Rate")}</span><span className="font-semibold">{fmtCurrency(wp.dailyRate)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("أيام الحضور", "Present")}</span><span>{wp.presentDays}/7</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("الراتب", "Salary")}</span><span className="font-semibold">{fmtCurrency(wp.grossPay)}</span></div>
                        {approvePendingInc > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("حافز مرحّل", "Carried Inc.")}</span><span className="font-semibold text-amber-500">+{fmtCurrency(approvePendingInc)}</span></div>}
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("الإجمالي", "Gross")}</span><span className="font-semibold">{fmtCurrency(grossWithInc)}</span></div>
                        {approveEmp.advances > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("السلف", "Advances")}</span><span className="text-destructive">-{fmtCurrency(approveEmp.advances)}</span></div>}
                        <hr className="border-border/50" />
                        <div className="flex justify-between font-bold"><span>{t("الصافي", "Net")}</span><span className="text-primary">{fmtCurrency(net)}</span></div>
                        <Button className="w-full mt-2 gap-2" onClick={handleApproveWeekly} disabled={grossWithInc <= 0}>
                          <CheckCircle2 className="w-4 h-4" />{t("اعتماد (مع الحافز)", "Approve (Inc. included)")}
                        </Button>
                      </div>
                    );
                  }
                  const { dailyRate, presentDays, absentDays, grossBase } = computePayrollToDate(approveEmp);
                  const grossPay = grossBase;
                  const grossWithInc = grossPay + approvePendingInc;
                  const net = Math.max(0, grossWithInc - approveEmp.advances - approveEmp.deductions);
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("السعر اليومي", "Daily Rate")}</span><span className="font-semibold">{fmtCurrency(dailyRate)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("أيام الحضور", "Present")}</span><span>{presentDays}/30</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("الراتب", "Salary")}</span><span className="font-semibold">{fmtCurrency(grossPay)}</span></div>
                      {approvePendingInc > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("حافز مرحّل", "Carried Inc.")}</span><span className="font-semibold text-amber-500">+{fmtCurrency(approvePendingInc)}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("الإجمالي", "Gross")}</span><span className="font-semibold">{fmtCurrency(grossWithInc)}</span></div>
                      {approveEmp.advances > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("السلف", "Advances")}</span><span className="text-destructive">-{fmtCurrency(approveEmp.advances)}</span></div>}
                      <hr className="border-border/50" />
                      <div className="flex justify-between font-bold"><span>{t("الصافي", "Net")}</span><span className="text-primary">{fmtCurrency(net)}</span></div>
                      <Button className="w-full mt-2 gap-2" onClick={handleApproveMonthly} disabled={grossWithInc <= 0}>
                        <CheckCircle2 className="w-4 h-4" />{t("اعتماد الشهر (مع الحافز)", "Approve Month (Inc. included)")}
                      </Button>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}
          {approveAction === "approving" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 flex flex-col items-center gap-4">
              <div className="relative w-16 h-16"><motion.div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} /><div className="absolute inset-0 flex items-center justify-center"><DollarSign className="w-6 h-6 text-primary" /></div></div>
              <p className="text-sm font-medium text-muted-foreground">{t("جاري الاعتماد...", "Approving...")}</p>
            </motion.div>
          )}
          {approveAction === "done" && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-16 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-500" /></div>
              <p className="font-semibold text-emerald-500">{approveDoneLabel}</p>
              <Button onClick={() => { setApproveAction("idle"); setApproveEmpOpen(false); setApproveEmp(null); }}>{t("إغلاق", "Close")}</Button>
            </motion.div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── History Sheet ── */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("سجل الرواتب", "Payroll History")}</SheetTitle>
            <SheetDescription>{t("المرتبات المعتمدة سابقاً", "Previously approved payrolls")}</SheetDescription>
          </SheetHeader>
          {payrollTransactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground"><History className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>{t("لا يوجد سجل بعد", "No history yet")}</p></div>
          ) : (
            <div className="space-y-3">
              {[...payrollTransactions].reverse().map((tx) => (
                <Card key={tx.id} className="p-3 sm:p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedTx(selectedTx?.id === tx.id ? null : tx)}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{MONTH_NAMES[tx.month]} {tx.year}{tx.weekNumber ? ` — ${t(`الأسبوع ${tx.weekNumber}`, `Week ${tx.weekNumber}`)}` : ""}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(tx.approvedAt)}
                        <Badge variant="outline" className={`text-[9px] mr-2 px-1.5 ${tx.approvalType === "incentive" ? "text-amber-500 border-amber-500/30 bg-amber-500/10" : tx.approvalType === "salary_weekly" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" : "text-primary border-primary/30 bg-primary/10"}`}>
                          {tx.approvalType === "incentive" ? t("حافز", "Inc.") : tx.approvalType === "salary_weekly" ? t("أسبوعي", "Wk.") : t("شهري", "Mo.")}
                        </Badge>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{tx.employeeCount} {t("موظف", "emp.")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("الإجمالي", "Gross")}: {fmtCurrency(tx.totalGross)}</span>
                    <span className="font-bold text-primary">{t("الصافي", "Net")}: {fmtCurrency(tx.totalNet)}</span>
                  </div>
                  {selectedTx?.id === tx.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 pt-3 border-t border-border space-y-2">
                      {tx.breakdown.map(b => (
                        <div key={b.employeeId} className="flex justify-between text-xs">
                          <span className="font-medium">{b.name}</span>
                          <span className="text-muted-foreground">
                            {tx.approvalType === "incentive" ? <span className="text-amber-500">{fmtCurrency(b.incentivePaid)} {t("حافز", "inc.")}</span> : <>{b.presentDays}/{b.presentDays + b.absentDays} {t("أيام", "d")} — {fmtCurrency(b.netPay)}</>}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Payroll Report Dialog ── */}
      <Dialog open={repOpen} onOpenChange={setRepOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="w-5 h-5 text-primary" />
              {t("تقرير الرواتب", "Payroll Report")}
            </DialogTitle>
          </DialogHeader>
          {!repGenerated ? (
            <div className="space-y-5 py-2">
              {/* Date mode */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("نطاق التاريخ", "Date Range")}</Label>
                <div className="flex gap-2 flex-wrap">
                  {(["all", "today", "range"] as DateMode[]).map(m => (
                    <button key={m} onClick={() => { setRepDateMode(m); setRepGenerated(false); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        repDateMode === m ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {m === "all" ? t("كل الفترة", "All Period") : m === "today" ? t("اليوم فقط", "Today Only") : t("نطاق", "Range")}
                    </button>
                  ))}
                </div>
                {repDateMode === "range" && (
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">{t("من", "From")}</Label>
                      <input type="date" value={repDateFrom} onChange={e => setRepDateFrom(e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm outline-none mt-1" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">{t("إلى", "To")}</Label>
                      <input type="date" value={repDateTo} onChange={e => setRepDateTo(e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm outline-none mt-1" />
                    </div>
                  </div>
                )}
              </div>

              {/* Search filter */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">{t("بحث موظف", "Search Employee")}</Label>
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <SmartInput placeholder={t("اسم الموظف...", "Employee name...")} value={repSearch} onChange={setRepSearch}
                      className="bg-transparent text-sm outline-none border-0 p-0 shadow-none focus-visible:ring-0 w-full" extraSuggestions={employees.map(e => e.name)} showSuggestion={false} />
                  </div>
                </div>
              </div>

              {/* Sections toggles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("الأقسام", "Sections")}</Label>
                <div className="flex gap-3 flex-wrap">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={repSummary} onChange={e => setRepSummary(e.target.checked)} className="rounded" />
                    {t("ملخص", "Summary")}
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={repDetails} onChange={e => setRepDetails(e.target.checked)} className="rounded" />
                    {t("تفاصيل الرواتب", "Salary Details")}
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={repDeductions} onChange={e => setRepDeductions(e.target.checked)} className="rounded" />
                    {t("الخصومات", "Deductions")}
                  </label>
                </div>
              </div>

              <Button onClick={handleGenerateReport} disabled={repGenerating} className="w-full gap-2 rounded-xl">
                {repGenerating ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t("جاري إنشاء التقرير...", "Generating...")}</>
                ) : (
                  <><BarChart3 className="w-4 h-4" />{t("إنشاء التقرير", "Generate Report")}</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-600 text-sm">{t("تم إنشاء التقرير بنجاح", "Report generated successfully")}</p>
                  <p className="text-xs text-muted-foreground">{t("يمكنك الآن معاينة التقرير أو طباعته", "You can now preview or print the report")}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleDownloadPDF} className="flex-1 gap-2 rounded-xl">
                  <Download className="w-4 h-4" />{t("معاينة وطباعة", "Preview & Print")}
                </Button>
                <Button variant="outline" onClick={() => { setRepGenerated(false); setRepOpen(false); }} className="flex-1 gap-2 rounded-xl">
                  {t("إنشاء تقرير جديد", "New Report")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
