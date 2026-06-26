import React, { useState, useMemo } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useHRStore, calcDailyRate, type AttendanceStatus } from "@/hooks/use-hr-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SmartInput from "@/components/SmartInput";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Clock, MinusCircle, CalendarDays, Users, Search, Timer, DollarSign, LogIn, LogOut, AlertTriangle, BarChart3, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } };

const fmt12 = (t: string) => {
  if (!t) return "--:-- --";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
};

export default function Attendance() {
  const { t } = useAppStore();
  const { employees, shifts, attendance, attendanceReasons, attendanceDeductions, checkIn, checkOut, setAttendanceFull, setCheckIn, setCheckOut, computeOvertime } = useHRStore();

  const todayStr = new Date().toISOString().split("T")[0];
  const [viewDate, setViewDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repSummary, setRepSummary] = useState(true);
  const [repDaily, setRepDaily] = useState(true);
  const [repAbsent, setRepAbsent] = useState(true);

  const year = parseInt(viewDate.split("-")[0]);
  const month = parseInt(viewDate.split("-")[1]);
  const day = parseInt(viewDate.split("-")[2]);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const filtered = useMemo(() => {
    if (!searchQuery) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(e => e.name.toLowerCase().includes(q) || e.phone?.toLowerCase().includes(q));
  }, [employees, searchQuery]);

  const today = new Date();
  const viewDayDate = new Date(year, month - 1, day);
  const isTodayOrPast = viewDayDate <= today;

  const getStatus = (empId: string): AttendanceStatus =>
    attendance[empId]?.[dateStr] ?? "present";
  const getReason = (empId: string): string =>
    attendanceReasons?.[empId]?.[dateStr] ?? "";
  const getDeduction = (empId: string): number =>
    attendanceDeductions?.[empId]?.[dateStr] ?? 0;
  const getCheckIn = (empId: string): string =>
    checkIn[empId]?.[dateStr] ?? "";
  const getCheckOut = (empId: string): string =>
    checkOut[empId]?.[dateStr] ?? "";

  const handleStatus = (empId: string, val: "present" | "absent") => {
    if (val === "present") {
      setAttendanceFull(empId, dateStr, "present", undefined, undefined);
    } else {
      setAttendanceFull(empId, dateStr, "absent", getReason(empId) || undefined, undefined);
    }
  };

  const handleDeduction = (empId: string, amount: string) => {
    const num = parseFloat(amount) || 0;
    const cur = getStatus(empId);
    const isLate = cur === "late";
    const newSt = isLate ? "late" : (num > 0 ? "deduction" : "present");
    setAttendanceFull(empId, dateStr, newSt, undefined, num || undefined);
  };

  const handleLateToggle = (empId: string, checked: boolean) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    const dr = calcDailyRate(emp);
    const pct = emp.lateDeductionPct ?? 0;
    const amt = dr * pct / 100;
    const curDed = getDeduction(empId);
    if (checked) {
      setAttendanceFull(empId, dateStr, "late", undefined, amt || undefined);
    } else {
      setAttendanceFull(empId, dateStr, curDed > 0 ? "deduction" : "present", undefined, curDed || undefined);
    }
  };

  const handleReason = (empId: string, reason: string) => {
    setAttendanceFull(empId, dateStr, getStatus(empId), reason || undefined, undefined);
  };

  const handleCheckIn = (empId: string, time: string) => {
    setCheckIn(empId, dateStr, time);
    if (!time) return;
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    const shift = shifts.find(s => s.startTime === emp.workStartTime && (s.departments || []).includes(emp.department));
    const threshold = shift?.lateThresholdMinutes ?? 0;
    if (threshold <= 0) return;
    const [inH, inM] = time.split(":").map(Number);
    const [startH, startM] = (emp.workStartTime || "08:00").split(":").map(Number);
    const inMinutes = inH * 60 + inM;
    const startMinutes = startH * 60 + startM + threshold;
    if (inMinutes > startMinutes) {
      const cur = getStatus(empId);
      if (cur === "present" || cur === "late") {
        const dr = calcDailyRate(emp);
        const pct = emp.lateDeductionPct ?? 0;
        const amt = dr * pct / 100;
        setAttendanceFull(empId, dateStr, "late", undefined, amt || undefined);
      }
    }
  };

  const present = useMemo(() => filtered.filter(e => getStatus(e.id) !== "absent"), [filtered, attendance, dateStr, checkIn, checkOut]);
  const absent = useMemo(() => filtered.filter(e => getStatus(e.id) === "absent"), [filtered, attendance, dateStr]);
  const lateCount = useMemo(() => filtered.filter(e => getStatus(e.id) === "late").length, [filtered, attendance, dateStr]);

  const statCards = [
    { label: t("الإجمالي", "Total"), count: filtered.length, icon: Users, color: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/20" },
    { label: t("حاضر", "Present"), count: present.length, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
    { label: t("غائب", "Absent"), count: absent.length, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
    { label: t("متأخر", "Late"), count: lateCount, icon: Clock, color: "text-chart-3", bg: "bg-chart-3/10", border: "border-chart-3/20" },
  ];

  // ── Attendance Report ──
  const handleGenerateReport = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };
  const handleDownloadPDF = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = repDateMode === "all" ? t("كل الفترة", "All Period") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;
    const rptEmps = employees.filter(e => e.status === "active");
    const rptAttendance: { employeeId: string; date: string; status: string }[] = [];
    for (const empId of Object.keys(attendance)) {
      for (const [date, status] of Object.entries(attendance[empId] || {})) {
        if (repDateMode === "today" && date !== todayStr) continue;
        if (repDateMode === "range") {
          if (repDateFrom && date < repDateFrom) continue;
          if (repDateTo && date > repDateTo) continue;
        }
        rptAttendance.push({ employeeId: empId, date, status });
      }
    }
    const presentCount = rptAttendance.filter(a => a.status === "present" || a.status === "late").length;
    const absentCount = rptAttendance.filter(a => a.status === "absent").length;
    const lateCount = rptAttendance.filter(a => a.status === "late").length;
    const totalEmployees = rptEmps.length;
    const absentees = rptEmps.filter(e => !rptAttendance.some(a => a.employeeId === e.id) && e.status === "active");
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
        <div class="header-right"><h1>${t("تقرير الحضور", "Attendance Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>👥 ${totalEmployees} ${t("موظف", "employee(s)")}</span><span>📅 ${rptAttendance.length} ${t("تسجيل", "record(s)")}</span></div>
      ${repSummary ? `
      <div class="section"><h2>${t("ملخص الحضور", "Attendance Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${totalEmployees}</div><div class="lbl">${t("إجمالي الموظفين", "Total Employees")}</div></div>
          <div class="card"><div class="num num-green">${presentCount}</div><div class="lbl">${t("حاضر", "Present")}</div></div>
          <div class="card"><div class="num num-amber">${lateCount}</div><div class="lbl">${t("متأخر", "Late")}</div></div>
          <div class="card"><div class="num num-red">${absentCount}</div><div class="lbl">${t("غائب", "Absent")}</div></div>
        </div>
      </div>` : ""}
      ${repDaily && rptAttendance.length > 0 ? `
      <div class="section"><h2>${t("سجل الحضور", "Attendance Log")}</h2>
        <table><tr><th>#</th><th>${t("الموظف", "Employee")}</th><th>${t("التاريخ", "Date")}</th><th>${t("الحالة", "Status")}</th></tr>
        ${rptAttendance.map((a, i) => {
          const emp = employees.find(e => e.id === a.employeeId);
          const st = a.status === "present" ? `<span class="badge badge-green">${t("حاضر","Present")}</span>` : a.status === "late" ? `<span class="badge badge-amber">${t("متأخر","Late")}</span>` : `<span class="badge badge-red">${t("غائب","Absent")}</span>`;
          return `<tr><td>${i + 1}</td><td><strong>${emp?.name || a.employeeId}</strong></td><td>${a.date}</td><td>${st}</td></tr>`;
        }).join("")}
        </table>
      </div>` : ""}
      ${repAbsent && absentees.length > 0 ? `
      <div class="section"><h2>${t("المتغيبون", "Absentees")} (${absentees.length})</h2>
        <table><tr><th>#</th><th>${t("الموظف", "Employee")}</th><th>${t("القسم", "Department")}</th></tr>
        ${absentees.map((e, i) => `<tr><td>${i + 1}</td><td><strong>${e.name}</strong></td><td>${e.department || "—"}</td></tr>`).join("")}
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
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-5 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("الحضور والانصراف", "Attendance")}</h1>
            <p className="text-xs text-muted-foreground">{t("تسجيل ومتابعة حضور وانصراف الموظفين", "Track employee attendance")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">{t("التاريخ", "Date")}</Label>
          <Input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)}
            className="w-full sm:w-40 h-9 text-sm" />
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setRepOpen(true)}>
            <BarChart3 className="w-4 h-4" />{t("تقرير", "Report")}
          </Button>
        </div>
      </motion.div>

      {/* Stats Strip */}
      <motion.div initial="hidden" animate="show" variants={containerVariants}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(({ label, count, icon: Icon, color, bg, border }) => (
          <motion.div key={label} variants={itemVariants}>
            <Card className={`${bg} ${border} border-2 p-3 flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-lg ${color} bg-white flex items-center justify-center shadow-sm`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Future date warning */}
      <AnimatePresence>
        {!isTodayOrPast && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="p-4 border-chart-3/40 bg-chart-3/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-chart-3 shrink-0" />
                <p className="text-chart-3 text-sm">{t("لا يمكن تعديل الحضور لتاريخ مستقبلي", "Cannot edit attendance for a future date")}</p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <SmartInput placeholder={t("بحث بالاسم أو رقم الهاتف", "Search by name or phone")}
              value={searchQuery} onChange={setSearchQuery} className="pr-10 h-9 text-sm" extraSuggestions={employees.map(e => e.name)} />
          </div>
        </Card>
      </motion.div>

      {/* TOP: Display cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
        {/* Present Card */}
        <motion.div variants={scaleIn} initial="hidden" animate="show" transition={{ delay: 0.15 }}>
          <Card className="overflow-hidden border-t-[3px] border-t-primary shadow-sm">
            <div className="px-4 py-3 bg-gradient-to-l from-primary/5 to-[#12151c] flex items-center gap-2 border-b">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="font-semibold text-primary">{t("حاضر", "Present")}</span>
              <Badge variant="secondary" className="mr-auto text-xs bg-primary/10 text-primary">{present.length}</Badge>
            </div>
            <div className="divide-y max-h-[280px] overflow-y-auto">
              <AnimatePresence>
                {present.map(emp => {
                  const ci = getCheckIn(emp.id);
                  const co = getCheckOut(emp.id);
                  const ot = computeOvertime(emp, dateStr);
                  const st = getStatus(emp.id);
                  return (
                    <motion.div key={emp.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }} className="p-2.5 flex items-center gap-2 hover:bg-primary/5 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {emp.name.substring(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight">{emp.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{emp.department}</div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] shrink-0">
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          <LogIn className="w-3 h-3 text-chart-2" />
                          <span className="font-medium text-foreground">{fmt12(ci)}</span>
                        </span>
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          <LogOut className="w-3 h-3 text-chart-2" />
                          <span className="font-medium text-foreground">{fmt12(co)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {ot.hours > 0 && (
                          <Badge variant="outline" className="text-[10px] h-5 bg-chart-2/10 text-chart-2 border-chart-2/20">
                            +{ot.hours}h
                          </Badge>
                        )}
                        {st === "late" && (
                          <Badge variant="outline" className="text-[10px] h-5 bg-chart-3/10 text-chart-3 border-chart-3/20">
                            <Clock className="w-2.5 h-2.5 ml-0.5" />{t("تأخير", "Late")}
                          </Badge>
                        )}
                        {getDeduction(emp.id) > 0 && (
                          <Badge variant="outline" className="text-[10px] h-5 bg-chart-4/10 text-chart-4 border-chart-4/20">
                            خصم {getDeduction(emp.id)}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {present.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">{t("لا يوجد موظفين", "No employees")}</div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Absent Card */}
        <motion.div variants={scaleIn} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
          <Card className="overflow-hidden border-t-[3px] border-t-destructive shadow-sm">
            <div className="px-4 py-3 bg-gradient-to-l from-destructive/5 to-[#12151c] flex items-center gap-2 border-b">
              <XCircle className="w-5 h-5 text-destructive" />
              <span className="font-semibold text-destructive">{t("غائب", "Absent")}</span>
              <Badge variant="secondary" className="mr-auto text-xs bg-destructive/10 text-destructive">{absent.length}</Badge>
            </div>
            <div className="divide-y max-h-[280px] overflow-y-auto">
              <AnimatePresence>
                {absent.map(emp => (
                  <motion.div key={emp.id} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }} className="p-2.5 flex items-center gap-2 hover:bg-destructive/5 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-xs font-bold shrink-0">
                      {emp.name.substring(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight">{emp.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{emp.department}</div>
                    </div>
                    {getReason(emp.id) && (
                      <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">{getReason(emp.id)}</Badge>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {absent.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">{t("لا يوجد موظفين", "No employees")}</div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* BOTTOM: Editable employee list */}
      <motion.div variants={scaleIn} initial="hidden" animate="show" transition={{ delay: 0.25 }}>
        <Card className="overflow-hidden border-t-[3px] border-t-chart-2 shadow-sm">
          <div className="px-4 py-3 bg-gradient-to-l from-chart-2/5 to-[#12151c] flex items-center gap-2 border-b">
            <Users className="w-5 h-5 text-chart-2" />
            <span className="font-semibold text-chart-2">{t("تسجيل الحضور", "Attendance Entry")}</span>
            <Badge variant="secondary" className="mr-auto text-xs bg-chart-2/10 text-chart-2">{filtered.length}</Badge>
          </div>
          <div className="divide-y">
            <AnimatePresence>
              {filtered.map((emp, i) => {
                const status = getStatus(emp.id);
                const isLate = status === "late";
                const deduction = getDeduction(emp.id);
                const reason = getReason(emp.id);
                const dr = calcDailyRate(emp);
                const latePct = emp.lateDeductionPct ?? 0;
                const lateAmt = dr * latePct / 100;
                const isPresent = status !== "absent";
                const ci = getCheckIn(emp.id);
                const co = getCheckOut(emp.id);
                const ot = computeOvertime(emp, dateStr);

                return (
                  <motion.div key={emp.id} variants={itemVariants} initial="hidden" animate="show" custom={i}
                    className="p-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap mb-2.5">
                      <div className="flex items-center gap-2.5 flex-1 min-w-[140px]">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {emp.name.substring(0, 1)}
                        </div>
                        <div>
                          <span className="font-medium text-sm">{emp.name}</span>
                          <div className="text-[10px] text-muted-foreground">{emp.department} · {emp.position}</div>
                        </div>
                      </div>

                      <div className="flex bg-muted/40 rounded-lg p-0.5 border shadow-sm">
                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={() => handleStatus(emp.id, "present")} disabled={!isTodayOrPast}
                          className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1 ${
                            isPresent ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />{t("حاضر", "Present")}
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={() => handleStatus(emp.id, "absent")} disabled={!isTodayOrPast}
                          className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1 ${
                            !isPresent ? "bg-destructive text-destructive-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}>
                          <XCircle className="w-3.5 h-3.5" />{t("غائب", "Absent")}
                        </motion.button>
                      </div>
                    </div>

                    {/* Present controls */}
                    {isPresent && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="flex items-center gap-2.5 flex-wrap mr-10">
                        <div className="flex items-center gap-1.5 bg-chart-2/10 rounded-lg px-2 py-1 border border-chart-2/20">
                          <LogIn className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                          <Input type="time" value={ci} onChange={e => handleCheckIn(emp.id, e.target.value)}
                            className="w-20 h-6 text-xs border-0 bg-transparent px-0 focus-visible:ring-0" disabled={!isTodayOrPast} />
                        </div>
                        <div className="flex items-center gap-1.5 bg-chart-2/10 rounded-lg px-2 py-1 border border-chart-2/20">
                          <LogOut className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                          <Input type="time" value={co} onChange={e => setCheckOut(emp.id, dateStr, e.target.value)}
                            className="w-20 h-6 text-xs border-0 bg-transparent px-0 focus-visible:ring-0" disabled={!isTodayOrPast} />
                        </div>

                        {ot.hours > 0 && (
                          <Badge variant="outline" className="text-[11px] h-6 bg-chart-2/10 text-chart-2 border-chart-2/20">
                            <DollarSign className="w-3 h-3 ml-0.5" />{ot.hours}h × {emp.overtimeRate}x = {ot.pay} ج.م
                          </Badge>
                        )}

                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={() => handleLateToggle(emp.id, !isLate)} disabled={!isTodayOrPast}
                          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all border flex items-center gap-1 ${
                            isLate
                              ? "bg-chart-3 text-white shadow-sm border-chart-3"
                              : "text-chart-3 bg-chart-3/10 border-chart-3/20 hover:bg-chart-3/20"
                          }`}>
                          <Clock className="w-3 h-3" />{t("تأخير", "Late")}
                          {isLate && lateAmt > 0 && <span>({lateAmt.toFixed(0)})</span>}
                        </motion.button>

                        <div className="flex items-center gap-1.5 bg-chart-4/10 rounded-lg px-2 py-1 border border-chart-4/20">
                          <MinusCircle className="w-3.5 h-3.5 text-chart-4 shrink-0" />
                          <Input type="number" value={deduction || ""}
                            onChange={e => handleDeduction(emp.id, e.target.value)}
                            placeholder="0" className="w-14 h-6 text-xs border-0 bg-transparent px-0 focus-visible:ring-0" disabled={!isTodayOrPast} />
                          <span className="text-[10px] text-muted-foreground">ج.م</span>
                        </div>
                      </motion.div>
                    )}

                    {/* Absent controls */}
                    {!isPresent && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="flex items-center gap-2 mr-10">
                        <Input value={reason}
                          onChange={e => handleReason(emp.id, e.target.value)}
                          placeholder={t("سبب الغياب", "Absence reason")}
                          className="w-44 h-7 text-xs" disabled={!isTodayOrPast} />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div className="p-10 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{t("لا يوجد موظفين", "No employees found")}</p>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
      {/* ── Report Dialog ── */}
      <Dialog open={repOpen} onOpenChange={o => { setRepOpen(o); if (!o) { setRepGenerated(false); setRepGenerating(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5 text-primary" />
              {t("تقرير الحضور", "Attendance Report")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Period selector */}
            <div>
              <Label className="text-xs font-medium mb-2 block">{t("الفترة", "Period")}</Label>
              <div className="flex gap-2">
                {(["all", "today", "range"] as DateMode[]).map(mode => (
                  <button key={mode} type="button"
                    onClick={() => { setRepDateMode(mode); setRepGenerated(false); }}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all border ${
                      repDateMode === mode
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}>
                    {mode === "all" ? t("كل الفترة", "All Period") : mode === "today" ? t("اليوم فقط", "Today") : t("نطاق", "Range")}
                  </button>
                ))}
              </div>
            </div>
            {repDateMode === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-medium">{t("من", "From")}</Label><Input type="date" value={repDateFrom} onChange={e => { setRepDateFrom(e.target.value); setRepGenerated(false); }} className="h-9 text-sm" /></div>
                <div><Label className="text-xs font-medium">{t("إلى", "To")}</Label><Input type="date" value={repDateTo} onChange={e => { setRepDateTo(e.target.value); setRepGenerated(false); }} className="h-9 text-sm" /></div>
              </div>
            )}
            {/* Section toggles */}
            <div>
              <Label className="text-xs font-medium mb-2 block">{t("الأقسام", "Sections")}</Label>
              <div className="space-y-1.5">
                {[
                  { key: "repSummary", label: t("ملخص الحضور", "Summary"), state: repSummary, set: setRepSummary },
                  { key: "repDaily", label: t("سجل الحضور", "Daily Log"), state: repDaily, set: setRepDaily },
                  { key: "repAbsent", label: t("المتغيبون", "Absentees"), state: repAbsent, set: setRepAbsent },
                ].map(({ label, state, set }) => (
                  <label key={label} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <input type="checkbox" checked={state} onChange={e => { set(e.target.checked); setRepGenerated(false); }}
                      className="accent-primary w-4 h-4 rounded border-border" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleGenerateReport} disabled={repGenerating || (repDateMode === "range" && !repDateFrom && !repDateTo)}
                className="flex-1 gap-2 rounded-xl">
                {repGenerating ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t("جاري التوليد", "Generating...")}</>
                ) : (
                  <><BarChart3 className="w-4 h-4" />{t("توليد التقرير", "Generate Report")}</>
                )}
              </Button>
              {repGenerated && (
                <Button variant="outline" onClick={handleDownloadPDF} className="gap-2 rounded-xl">
                  <Download className="w-4 h-4" />{t("تحميل PDF", "Download PDF")}
                </Button>
              )}
            </div>
            {repGenerated && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10 text-sm text-primary">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {t("تم إنشاء التقرير بنجاح، يمكنك الآن تنزيله", "Report generated successfully. You can now download it.")}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
