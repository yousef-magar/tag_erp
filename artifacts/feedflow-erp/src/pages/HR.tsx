import React, { useState } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useHRStore, type Employee, type SalaryType } from "@/hooks/use-hr-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SmartInput from "@/components/SmartInput";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { UserCircle, UserPlus, FileText, CheckCircle2, Phone, Calendar, DollarSign, Clock, ChevronDown, Plus, X, Hash, Pencil, Trash2, Banknote, BarChart3, Download } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const fmtCurrency = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const SALARY_LABELS: Record<SalaryType, { ar: string; en: string }> = {
  monthly: { ar: "شهري", en: "Monthly" },
  weekly: { ar: "أسبوعي", en: "Weekly" },
};

export default function HR() {
  const { t } = useAppStore();
  const { departments, employees, shifts, addDepartment, addShift, removeShift, updateShift, addEmployee, updateEmployee, deleteEmployee, deductLeave, getLeaveBalance, computePendingIncentive } = useHRStore();

  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [leaveSubmitted, setLeaveSubmitted] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repSummary, setRepSummary] = useState(true);
  const [repEmployeeList, setRepEmployeeList] = useState(true);
  const [repContracts, setRepContracts] = useState(true);
  const [repDepartment, setRepDepartment] = useState("");

  // Add form
  const [empName, setEmpName] = useState("");
  const [empDept, setEmpDept] = useState("");
  const [empPosition, setEmpPosition] = useState("");
  const [empSalary, setEmpSalary] = useState("");
  const [empPhone, setEmpPhone] = useState("");
  const [empSalaryType, setEmpSalaryType] = useState<SalaryType>("monthly");
  const [empDailyInc, setEmpDailyInc] = useState("");
  const [empLatePct, setEmpLatePct] = useState("");
  const [empShiftId, setEmpShiftId] = useState("");
  const [empWorkStart, setEmpWorkStart] = useState("08:00");
  const [empWorkEnd, setEmpWorkEnd] = useState("16:00");
  const [empWorkHours, setEmpWorkHours] = useState("8");
  const [empOTRate, setEmpOTRate] = useState("1.5");
  const [empJoinDate, setEmpJoinDate] = useState(new Date().toISOString().split("T")[0]);
  const [deptOpen, setDeptOpen] = useState(false);
  const [newDept, setNewDept] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSalaryType, setEditSalaryType] = useState<SalaryType>("monthly");
  const [editDailyInc, setEditDailyInc] = useState("");
  const [editLatePct, setEditLatePct] = useState("");
  const [editShiftId, setEditShiftId] = useState("");
  const [editWorkStart, setEditWorkStart] = useState("08:00");
  const [editWorkEnd, setEditWorkEnd] = useState("16:00");
  const [editWorkHours, setEditWorkHours] = useState("8");
  const [editOTRate, setEditOTRate] = useState("1.5");
  const [editDeptOpen, setEditDeptOpen] = useState(false);
  const [editNewDept, setEditNewDept] = useState("");

  // Leave form
  const [leaveType, setLeaveType] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const handleAddEmployee = () => {
    if (!empName || !empDept || !empPosition || !empSalary) return;
    addEmployee({
      name: empName,
      phone: empPhone,
      department: empDept,
      position: empPosition,
      salaryType: empSalaryType,
      baseSalary: parseFloat(empSalary) || 0,
      dailyIncentive: parseFloat(empDailyInc) || 0,
      lateDeductionPct: parseFloat(empLatePct) || 0,
      status: "present",
      allowances: 0,
      overtime: 0,
      deductions: 0,
      advances: 0,
      joinDate: empJoinDate,
      notes: "",
      workStartTime: empWorkStart,
      workEndTime: empWorkEnd,
      workHours: parseFloat(empWorkHours) || 8,
      overtimeRate: parseFloat(empOTRate) || 1.5,
      commissionType: "none",
      commissionRate: 0,
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false); setAddOpen(false);
      setEmpName(""); setEmpDept(""); setEmpPosition(""); setEmpSalary(""); setEmpPhone(""); setEmpSalaryType("monthly"); setEmpDailyInc(""); setEmpLatePct(""); setEmpWorkStart("08:00"); setEmpWorkEnd("16:00"); setEmpWorkHours("8"); setEmpOTRate("1.5"); setEmpJoinDate(new Date().toISOString().split("T")[0]);
    }, 1400);
  };

  const handleLeaveSubmit = () => {
    if (!leaveType || !leaveFrom || !leaveTo || !selectedEmployee) return;
    const from = new Date(leaveFrom);
    const to = new Date(leaveTo);
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const year = from.getFullYear();
    deductLeave(selectedEmployee.id, year, days);
    setLeaveSubmitted(true);
    setTimeout(() => {
      setLeaveSubmitted(false); setLeaveOpen(false);
      setLeaveType(""); setLeaveFrom(""); setLeaveTo(""); setLeaveReason("");
    }, 1400);
  };

  const handleEditEmployee = () => {
    if (!editName || !editDept || !editPosition || !editSalary || !selectedEmployee) return;
    updateEmployee(selectedEmployee.id, {
      name: editName,
      phone: editPhone,
      department: editDept,
      position: editPosition,
      salaryType: editSalaryType,
      baseSalary: parseFloat(editSalary) || 0,
      dailyIncentive: parseFloat(editDailyInc) || 0,
      lateDeductionPct: parseFloat(editLatePct) || 0,
      workStartTime: editWorkStart || "08:00",
      workEndTime: editWorkEnd || "16:00",
      workHours: parseFloat(editWorkHours) || 8,
      overtimeRate: parseFloat(editOTRate) || 1.5,
    });
    setEditSubmitted(true);
    setTimeout(() => {
      setEditSubmitted(false); setEditOpen(false); setSelectedEmployee(null);
    }, 1400);
  };

  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditName(emp.name);
    setEditDept(emp.department);
    setEditPosition(emp.position);
    setEditSalary(String(emp.baseSalary));
    setEditPhone(emp.phone);
    setEditSalaryType(emp.salaryType);
    setEditDailyInc(String(emp.dailyIncentive));
    setEditLatePct(String(emp.lateDeductionPct ?? 0));
    setEditWorkStart(emp.workStartTime || "08:00");
    setEditWorkEnd(emp.workEndTime || "16:00");
    setEditWorkHours(String(emp.workHours ?? 8));
    setEditOTRate(String(emp.overtimeRate ?? 1.5));
    applyShiftForDept(emp.department, setEditShiftId, setEditWorkStart, setEditWorkEnd, setEditWorkHours);
    setEditOpen(true);
  };

  const findShiftForDept = (dept: string) => {
    const matching = shifts.filter(sh => (sh.departments || []).includes(dept));
    return matching.length === 1 ? matching[0].id : "";
  };

  const applyShiftForDept = (dept: string, setShiftId: (id: string) => void, setStart: (v: string) => void, setEnd: (v: string) => void, setHours: (v: string) => void) => {
    const sid = findShiftForDept(dept);
    if (!sid) return;
    setShiftId(sid);
    const shift = shifts.find(s => s.id === sid);
    if (!shift) return;
    setStart(shift.startTime);
    setEnd(shift.endTime);
    const [h1, m1] = shift.startTime.split(":").map(Number);
    const [h2, m2] = shift.endTime.split(":").map(Number);
    setHours(String(h2 > h1 ? h2 - h1 : 24 - h1 + h2));
  };

  const handleDeptSelect = (dept: string) => {
    setEmpDept(dept);
    applyShiftForDept(dept, setEmpShiftId, setEmpWorkStart, setEmpWorkEnd, setEmpWorkHours);
    setDeptOpen(false);
  };

  const handleAddDept = () => {
    const name = newDept.trim();
    if (!name) return;
    addDepartment(name);
    setEmpDept(name);
    setNewDept("");
    applyShiftForDept(name, setEmpShiftId, setEmpWorkStart, setEmpWorkEnd, setEmpWorkHours);
    setDeptOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present": return <Badge className="bg-primary/10 text-primary border-primary/20">{t("حاضر", "Present")}</Badge>;
      case "absent": return <Badge className="bg-destructive/10 text-destructive border-destructive/20">{t("غائب", "Absent")}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ── HR Report ──
  const handleGenerateHRReport = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };
  const handleDownloadHRPDF = () => {
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = repDateMode === "all" ? t("كل الفترة", "All Period") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;
    
    const rptEmps = employees.filter(e => !repDepartment || e.department === repDepartment);
    const activeEmps = rptEmps.filter(e => e.status === "active");
    const expiringContracts: Employee[] = [];
    const deptCount: Record<string, number> = {};
    rptEmps.forEach(e => { const d = e.department || "Other"; deptCount[d] = (deptCount[d] || 0) + 1; });
    
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
      .badge-green{background:#dcfce7;color:#15803d}.badge-red{background:#fee2e2;color:#dc2626}.badge-amber{background:#fef3c7;color:#b45309}.badge-blue{background:#dbeafe;color:#1d4ed8}
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
    `;
    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right"><h1>${t("تقرير الموارد البشرية", "HR Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>👥 ${rptEmps.length} ${t("موظف", "employee(s)")}</span><span>📂 ${departments.length} ${t("قسم", "department(s)")}</span></div>
      ${repSummary ? `
      <div class="section"><h2>${t("ملخص الموظفين", "Employee Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${rptEmps.length}</div><div class="lbl">${t("إجمالي الموظفين", "Total Employees")}</div></div>
          <div class="card"><div class="num num-green">${activeEmps.length}</div><div class="lbl">${t("نشط", "Active")}</div></div>
          <div class="card"><div class="num num-amber">${rptEmps.filter(e => e.status !== "active").length}</div><div class="lbl">${t("غير نشط", "Inactive")}</div></div>
          <div class="card"><div class="num num-red">${expiringContracts.length}</div><div class="lbl">${t("عقود منتهية قريباً", "Expiring Soon")}</div></div>
        </div>
        <table style="margin-top:8px"><tr><th>${t("القسم", "Department")}</th><th>${t("عدد الموظفين", "Count")}</th></tr>
        ${Object.entries(deptCount).map(([dept, count]) => `<tr><td><strong>${dept}</strong></td><td>${count}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      ${repEmployeeList && rptEmps.length > 0 ? `
      <div class="section"><h2>${t("قائمة الموظفين", "Employee List")} (${rptEmps.length})</h2>
        <table><tr><th>#</th><th>${t("الاسم", "Name")}</th><th>${t("القسم", "Department")}</th><th>${t("الهاتف", "Phone")}</th><th>${t("الحالة", "Status")}</th></tr>
        ${rptEmps.map((e, i) => {
          const st = e.status === "active" ? `<span class="badge badge-green">${t("نشط","Active")}</span>` : `<span class="badge badge-red">${t("غير نشط","Inactive")}</span>`;
          return `<tr><td>${i + 1}</td><td><strong>${e.name}</strong></td><td>${e.department || "—"}</td><td>${e.phone || "—"}</td><td>${st}</td></tr>`;
        }).join("")}
        </table>
      </div>` : ""}
      ${repContracts && rptEmps.length > 0 ? `
      <div class="section"><h2>${t("بيانات التوظيف", "Employment Data")}</h2>
        <table><tr><th>#</th><th>${t("الموظف", "Employee")}</th><th>${t("القسم", "Department")}</th><th>${t("تاريخ الالتحاق", "Join Date")}</th><th>${t("الراتب", "Salary")}</th></tr>
        ${rptEmps.map((e, i) =>
          `<tr><td>${i + 1}</td><td><strong>${e.name}</strong></td><td>${e.department || "—"}</td><td>${e.joinDate || "—"}</td><td style="font-weight:600">${fmtCurrency(e.baseSalary || 0)}</td></tr>`
        ).join("")}
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
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("الموارد البشرية", "HR")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة الموظفين", "Employee management")}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 rounded-xl flex-1 sm:flex-initial" onClick={() => setRepOpen(true)}>
            <BarChart3 className="w-4 h-4" />{t("تقرير", "Report")}
          </Button>
          <Button className="gap-2 shadow-sm flex-1 sm:flex-initial" onClick={() => setAddOpen(true)}>
            <UserPlus className="w-4 h-4" />
            {t("إضافة موظف", "Add Employee")}
          </Button>
        </div>
      </motion.div>

      {/* Shifts Panel */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{t("الشيفتات", "Shifts")}</h2>
            </div>
            <Button size="sm" variant="outline" className="gap-1 h-8 w-full sm:w-auto" onClick={() => {
              const arabicNums = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
              const idx = shifts.length;
              addShift({ name: `الشيفت ${arabicNums[idx] || idx + 1}`, startTime: "08:00", endTime: "16:00", departments: [departments[0] || ""].filter(Boolean), lateThresholdMinutes: 15 });
            }}>
              <Plus className="w-3.5 h-3.5" />{t("شيفت +", "Shift +")}
            </Button>
          </div>
          <div className="p-4">
            <AnimatePresence mode="popLayout">
              {shifts.length === 0 ? (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-xs text-muted-foreground text-center py-4">{t("لا يوجد شيفتات. اضف شيفت جديد", "No shifts. Add a new shift.")}</motion.p>
              ) : (
                <motion.div key="list" initial="hidden" animate="show" exit="hidden" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                  className="flex flex-col gap-2">
                  {shifts.map((sh, i) => (
                    <motion.div key={sh.id} layout variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                      exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}>
                      <Card className="border-border/60 overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2 p-2.5">
                          <div style={{ backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#f97316", "#6366f1", "#14b8a6", "#ec4899"][i % 10] }}
                            className="w-1 h-8 rounded-full shrink-0" />
                          <SmartInput field="employee-name" value={sh.name} onChange={v => updateShift(sh.id, { name: v })}
                            className="h-7 text-sm font-bold w-full min-[400px]:w-24 sm:w-28 border-0 px-0 focus-visible:ring-0" extraSuggestions={shifts.map(s => s.name)} />
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5">
                            <span className="whitespace-nowrap">{t("بداية", "Start")}</span>
                            <Input type="time" value={sh.startTime} onChange={e => updateShift(sh.id, { startTime: e.target.value })}
                              className="w-14 h-5 text-[11px] border-0 bg-transparent px-0 focus-visible:ring-0" />
                            <span className="text-muted-foreground/30">→</span>
                            <Input type="time" value={sh.endTime} onChange={e => updateShift(sh.id, { endTime: e.target.value })}
                              className="w-14 h-5 text-[11px] border-0 bg-transparent px-0 focus-visible:ring-0" />
                            <span className="text-muted-foreground/30 mx-0.5">|</span>
                            <span className="whitespace-nowrap">{t("تأخير", "Late")}</span>
                            <Input type="number" min="0" value={sh.lateThresholdMinutes} onChange={e => updateShift(sh.id, { lateThresholdMinutes: parseInt(e.target.value) || 0 })}
                              className="w-10 h-5 text-[11px] border-0 bg-transparent px-0 focus-visible:ring-0 text-center" />
                            <span>{t("د", "min")}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0 min-[500px]:min-w-[120px]">
                            {(sh.departments || []).map(d => (
                              <span key={d} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full border border-primary/10 whitespace-nowrap">
                                {d}
                                <button onClick={() => updateShift(sh.id, { departments: (sh.departments || []).filter(x => x !== d) })} className="hover:text-destructive">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground text-xs w-5 h-5 inline-flex items-center justify-center rounded-full border border-dashed shrink-0">
                                  <Plus className="w-3 h-3" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[180px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder={t("قسم...", "Dept...")} />
                                  <CommandEmpty>
                                    <span className="text-xs text-muted-foreground p-2 block">{t("لا يوجد", "Not found")}</span>
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {departments.filter(d => !(sh.departments || []).includes(d)).map(d => (
                                      <CommandItem key={d} value={d} onSelect={() => updateShift(sh.id, { departments: [...(sh.departments || []), d] })}>
                                        {d}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                className="text-muted-foreground hover:text-destructive shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </motion.button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" align="end">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-destructive font-semibold whitespace-nowrap">{t("حذف الوردية؟", "Delete shift?")}</span>
                                <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => removeShift(sh.id)}>
                                  {t("نعم", "Yes")}
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {/* Employee Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 md:px-6 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("الموظف", "Employee")}</th>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("القسم", "Dept")}</th>
                  <th className="px-4 md:px-6 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("الراتب", "Salary")}</th>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("النوع", "Type")}</th>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("الحافز", "Incentive")}</th>
                  <th className="px-4 md:px-6 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("الحالة", "Status")}</th>
                  <th className="px-4 md:px-6 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">{t("إجراءات", "Actions")}</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                <AnimatePresence>
                  {employees.map((emp, i) => (
                    <motion.tr variants={itemVariants} key={emp.id} layout
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
                      <td className="px-4 md:px-6 py-3.5 font-medium">
                        <div className="flex items-center gap-3">
                          <motion.div whileHover={{ scale: 1.1 }}
                            className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                            {emp.name.substring(0, 1)}
                          </motion.div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate max-w-[140px]">{emp.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{emp.position}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-3.5">
                        <span className="text-xs bg-muted/50 px-2 py-1 rounded-md whitespace-nowrap">{emp.department}</span>
                      </td>
                      <td className="px-4 md:px-6 py-3.5 font-semibold whitespace-nowrap">{fmtCurrency(emp.baseSalary)}</td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-3.5">
                        <Badge variant="outline" className="text-[10px] font-medium whitespace-nowrap">
                          {t(SALARY_LABELS[emp.salaryType].ar, SALARY_LABELS[emp.salaryType].en)}
                        </Badge>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          {emp.dailyIncentive > 0 ? (
                            <span className="font-semibold text-primary whitespace-nowrap">{fmtCurrency(emp.dailyIncentive)}</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                          {(() => {
                            const pi = computePendingIncentive(emp.id);
                            return pi > 0 ? <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20 text-[9px] whitespace-nowrap">{t("مرحّل", "Carry")} {fmtCurrency(pi)}</Badge> : null;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3.5">{getStatusBadge(emp.status)}</td>
                      <td className="px-4 md:px-6 py-3.5">
                        <div className="flex items-center justify-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => { setSelectedEmployee(emp); setProfileOpen(true); }}>
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => openEdit(emp)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteConfirm(emp.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </motion.div>
                          <Link href="/payroll">
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button variant="ghost" size="sm" className="h-7 text-[10px] sm:text-[11px] text-primary hover:bg-primary/10 gap-1 whitespace-nowrap">
                                <Banknote className="w-2.5 h-2.5 sm:w-3 sm:h-3" />{t("الرواتب", "Payroll")}
                              </Button>
                            </motion.div>
                          </Link>
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] sm:text-[11px] text-chart-3 hover:bg-chart-3/10 hover:text-chart-3 whitespace-nowrap"
                              onClick={() => { setSelectedEmployee(emp); setLeaveOpen(true); }}>
                              <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />{t("إجازة", "Leave")}
                            </Button>
                          </motion.div>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </motion.tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border/50">
            {employees.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">{t("لا يوجد موظفون", "No employees")}</p>
            ) : (
              employees.map((emp, i) => (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {emp.name.substring(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{emp.position} · {emp.department}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-sm whitespace-nowrap">{fmtCurrency(emp.baseSalary)}</span>
                      {getStatusBadge(emp.status)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {t(SALARY_LABELS[emp.salaryType].ar, SALARY_LABELS[emp.salaryType].en)}
                    </Badge>
                    {emp.dailyIncentive > 0 && (
                      <span className="text-primary font-medium">{t("حافز", "Inc.")} {fmtCurrency(emp.dailyIncentive)}</span>
                    )}
                    {(() => {
                      const pi = computePendingIncentive(emp.id);
                      return pi > 0 ? <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20 text-[9px]">{t("مرحّل", "Carry")} {fmtCurrency(pi)}</Badge> : null;
                    })()}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1"
                      onClick={() => { setSelectedEmployee(emp); setProfileOpen(true); }}>
                      <FileText className="w-3 h-3" />{t("ملف", "Profile")}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1"
                      onClick={() => openEdit(emp)}>
                      <Pencil className="w-3 h-3" />{t("تعديل", "Edit")}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-chart-3"
                      onClick={() => { setSelectedEmployee(emp); setLeaveOpen(true); }}>
                      <Calendar className="w-3 h-3" />{t("إجازة", "Leave")}
                    </Button>
                    <Link href="/payroll">
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-primary">
                        <Banknote className="w-3 h-3" />{t("الرواتب", "Payroll")}
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-destructive/70"
                      onClick={() => setDeleteConfirm(emp.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </motion.div>

      {/* Add Employee Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("إضافة موظف جديد", "Add New Employee")}</SheetTitle>
            <SheetDescription>{t("أدخل بيانات الموظف الجديد", "Enter new employee details")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("الاسم الكامل", "Full Name")}</Label>
              <SmartInput field="employee-name" placeholder={t("اسم الموظف", "Employee name")} value={empName} onChange={setEmpName} extraSuggestions={employees.map(e => e.name)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label>{t("القسم", "Department")}</Label>
                <Popover open={deptOpen} onOpenChange={setDeptOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={deptOpen}
                      className="w-full justify-between h-10 text-sm font-normal bg-[#0e1016]">
                      {empDept || <span className="text-muted-foreground">{t("اختر القسم", "Select dept")}</span>}
                      <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t("بحث قسم...", "Search dept...")} onValueChange={setNewDept} />
                      <CommandEmpty>
                        <div className="p-2">
                          <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-xs"
                            onClick={handleAddDept}>
                            <Plus className="w-3 h-3" />
                            {t(`إضافة "${newDept}"`, `Add "${newDept}"`)}
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {departments.map((d) => (
                          <CommandItem key={d} value={d} onSelect={() => handleDeptSelect(d)}>
                            {d}
                          </CommandItem>
                        ))}
                        {newDept && !departments.includes(newDept) && (
                          <CommandItem value={`__new__${newDept}`} onSelect={handleAddDept}>
                            <Plus className="w-3 h-3 ml-2" />
                            {t(`إضافة "${newDept}"`, `Add "${newDept}"`)}
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t("المسمى الوظيفي", "Job Title")}</Label>
                <SmartInput field="employee-name" placeholder={t("المسمى الوظيفي", "Job title")} value={empPosition} onChange={setEmpPosition} extraSuggestions={[...new Set(employees.map(e => e.position).filter(Boolean))]} />
              </div>
            </div>

            {/* Salary type toggle */}
            <div className="space-y-2">
              <Label>{t("نوع الراتب", "Salary Type")}</Label>
              <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/40 w-fit">
                {(["monthly", "weekly"] as SalaryType[]).map((st) => (
                  <button key={st} onClick={() => setEmpSalaryType(st)}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${
                      empSalaryType === st
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {t(SALARY_LABELS[st].ar, SALARY_LABELS[st].en)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label>{t("الراتب الأساسي (ج.م)", "Base Salary (EGP)")}</Label>
                <Input type="number" min="0" placeholder="0" value={empSalary} onChange={e => setEmpSalary(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-primary" />
                  {t("الحافز اليومي (ج.م)", "Daily Incentive (EGP)")}
                </Label>
                <Input type="number" min="0" placeholder="0" value={empDailyInc} onChange={e => setEmpDailyInc(e.target.value)}
                  className="border-primary/30 focus-visible:ring-primary/20" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-chart-3" />
                  {t("خصم التأخير (%)", "Late Deduction %")}
                </Label>
                <Input type="number" min="0" max="100" placeholder="0" value={empLatePct} onChange={e => setEmpLatePct(e.target.value)}
                  className="border-chart-3/30 focus-visible:ring-chart-3/20" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("تاريخ التوظيف", "Hire Date")}</Label>
              <Input type="date" value={empJoinDate} onChange={e => setEmpJoinDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("رقم الهاتف", "Phone")}</Label>
              <Input placeholder="01XXXXXXXXX" value={empPhone} onChange={e => setEmpPhone(e.target.value)} dir="ltr" />
            </div>

            <div className="space-y-2">
              <Label>{t("الشيفت", "Shift")}</Label>
              <Select value={empShiftId} onValueChange={v => {
                const shift = shifts.find(s => s.id === v);
                setEmpShiftId(v);
                if (shift) {
                  setEmpWorkStart(shift.startTime);
                  setEmpWorkEnd(shift.endTime);
                  const [h1, m1] = shift.startTime.split(":").map(Number);
                  const [h2, m2] = shift.endTime.split(":").map(Number);
                  const hours = h2 > h1 ? h2 - h1 : 24 - h1 + h2;
                  setEmpWorkHours(String(hours));
                }
              }}>
                <SelectTrigger className="w-full h-10 bg-[#0e1016] border-input">
                  <SelectValue placeholder={t("بدون شيفت", "No shift")} />
                </SelectTrigger>
                <SelectContent className="bg-[#0e1016] border-border">
                  {shifts.map(sh => (
                    <SelectItem key={sh.id} value={sh.id}>{sh.name} ({sh.startTime} - {sh.endTime}) {(sh.departments||[]).join("، ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time settings */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{t("إعدادات الوقت", "Time Settings")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("بداية العمل", "Work Start")}</Label>
                  <Input type="time" value={empWorkStart} onChange={e => setEmpWorkStart(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("نهاية العمل", "Work End")}</Label>
                  <Input type="time" value={empWorkEnd} onChange={e => setEmpWorkEnd(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("ساعات العمل الرسمية", "Work Hours")}</Label>
                  <Input type="number" min="1" max="24" value={empWorkHours} onChange={e => setEmpWorkHours(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("معدل الأوفر تايم (x)", "Overtime Rate")}</Label>
                  <Input type="number" min="1" step="0.1" value={empOTRate} onChange={e => setEmpOTRate(e.target.value)} className="h-8" />
                  <p className="text-[10px] text-muted-foreground">{t("أجر الساعة × عدد ساعات الأوفر تايم × المعامل. مثال: 1.5 = نصف مرة زيادة", "Hourly rate × overtime hours × multiplier. e.g. 1.5 = time and a half")}</p>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary rounded-lg">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-medium">{t("تم إضافة الموظف!", "Employee added!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex flex-col sm:flex-row gap-3">
                  <Button className="w-full sm:flex-1" onClick={handleAddEmployee} disabled={!empName || !empDept || !empPosition || !empSalary}>
                    {t("إضافة الموظف", "Add Employee")}
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAddOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Employee Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("تعديل بيانات الموظف", "Edit Employee")}</SheetTitle>
            <SheetDescription>{selectedEmployee?.name}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("الاسم الكامل", "Full Name")}</Label>
              <SmartInput field="employee-name" value={editName} onChange={setEditName} extraSuggestions={employees.map(e => e.name)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label>{t("القسم", "Department")}</Label>
                <Popover open={editDeptOpen} onOpenChange={setEditDeptOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={editDeptOpen}
                      className="w-full justify-between h-10 text-sm font-normal bg-[#0e1016]">
                      {editDept || <span className="text-muted-foreground">{t("اختر القسم", "Select dept")}</span>}
                      <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t("بحث قسم...", "Search dept...")} onValueChange={setEditNewDept} />
                      <CommandEmpty>
                        <div className="p-2">
                          <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-xs"
                            onClick={() => { const n = editNewDept.trim(); if (n) { addDepartment(n); setEditDept(n); setEditDeptOpen(false); applyShiftForDept(n, setEditShiftId, setEditWorkStart, setEditWorkEnd, setEditWorkHours); } }}>
                            <Plus className="w-3 h-3" />
                            {t(`إضافة "${editNewDept}"`, `Add "${editNewDept}"`)}
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {departments.map((d) => (
                          <CommandItem key={d} value={d} onSelect={() => {
                            setEditDept(d); setEditDeptOpen(false);
                            applyShiftForDept(d, setEditShiftId, setEditWorkStart, setEditWorkEnd, setEditWorkHours);
                          }}>
                            {d}
                          </CommandItem>
                        ))}
                        {editNewDept && !departments.includes(editNewDept) && (
                          <CommandItem value={`__new__${editNewDept}`} onSelect={() => { addDepartment(editNewDept.trim()); setEditDept(editNewDept.trim()); setEditDeptOpen(false); applyShiftForDept(editNewDept.trim(), setEditShiftId, setEditWorkStart, setEditWorkEnd, setEditWorkHours); }}>
                            <Plus className="w-3 h-3 ml-2" />
                            {t(`إضافة "${editNewDept}"`, `Add "${editNewDept}"`)}
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t("المسمى الوظيفي", "Job Title")}</Label>
                <SmartInput field="employee-name" value={editPosition} onChange={setEditPosition} extraSuggestions={[...new Set(employees.map(e => e.position).filter(Boolean))]} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("نوع الراتب", "Salary Type")}</Label>
              <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/40 w-fit">
                {(["monthly", "weekly"] as SalaryType[]).map((st) => (
                  <button key={st} onClick={() => setEditSalaryType(st)}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${
                      editSalaryType === st ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {t(SALARY_LABELS[st].ar, SALARY_LABELS[st].en)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label>{t("الراتب الأساسي (ج.م)", "Base Salary (EGP)")}</Label>
                <Input type="number" min="0" value={editSalary} onChange={e => setEditSalary(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-primary" />
                  {t("الحافز اليومي (ج.م)", "Daily Incentive (EGP)")}
                </Label>
                <Input type="number" min="0" value={editDailyInc} onChange={e => setEditDailyInc(e.target.value)}
                  className="border-primary/30 focus-visible:ring-primary/20" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-chart-3" />
                  {t("خصم التأخير (%)", "Late Deduction %")}
                </Label>
                <Input type="number" min="0" max="100" value={editLatePct} onChange={e => setEditLatePct(e.target.value)}
                  className="border-chart-3/30 focus-visible:ring-chart-3/20" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("رقم الهاتف", "Phone")}</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} dir="ltr" />
            </div>

            <div className="space-y-2">
              <Label>{t("الشيفت", "Shift")}</Label>
              <Select value={editShiftId} onValueChange={v => {
                const shift = shifts.find(s => s.id === v);
                setEditShiftId(v);
                if (shift) {
                  setEditWorkStart(shift.startTime);
                  setEditWorkEnd(shift.endTime);
                  const [h1, m1] = shift.startTime.split(":").map(Number);
                  const [h2, m2] = shift.endTime.split(":").map(Number);
                  const hours = h2 > h1 ? h2 - h1 : 24 - h1 + h2;
                  setEditWorkHours(String(hours));
                }
              }}>
                <SelectTrigger className="w-full h-10 bg-[#0e1016] border-input">
                  <SelectValue placeholder={t("بدون شيفت", "No shift")} />
                </SelectTrigger>
                <SelectContent className="bg-[#0e1016] border-border">
                  {shifts.map(sh => (
                    <SelectItem key={sh.id} value={sh.id}>{sh.name} ({sh.startTime} - {sh.endTime}) {(sh.departments||[]).join("، ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time settings */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{t("إعدادات الوقت", "Time Settings")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("بداية العمل", "Work Start")}</Label>
                  <Input type="time" value={editWorkStart} onChange={e => setEditWorkStart(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("نهاية العمل", "Work End")}</Label>
                  <Input type="time" value={editWorkEnd} onChange={e => setEditWorkEnd(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("ساعات العمل الرسمية", "Work Hours")}</Label>
                  <Input type="number" min="1" max="24" value={editWorkHours} onChange={e => setEditWorkHours(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("معدل الأوفر تايم (x)", "Overtime Rate")}</Label>
                  <Input type="number" min="1" step="0.1" value={editOTRate} onChange={e => setEditOTRate(e.target.value)} className="h-8" />
                  <p className="text-[10px] text-muted-foreground">{t("أجر الساعة × عدد ساعات الأوفر تايم × المعامل. مثال: 1.5 = نصف مرة زيادة", "Hourly rate × overtime hours × multiplier. e.g. 1.5 = time and a half")}</p>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {editSubmitted ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary rounded-lg">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-medium">{t("تم تعديل الموظف!", "Employee updated!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex flex-col sm:flex-row gap-3">
                  <Button className="w-full sm:flex-1" onClick={handleEditEmployee} disabled={!editName || !editDept || !editPosition || !editSalary}>
                    {t("حفظ التعديلات", "Save Changes")}
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("حذف الموظف", "Delete Employee")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.", "Are you sure you want to delete this employee? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteConfirm) { deleteEmployee(deleteConfirm); setDeleteConfirm(null); } }}>
              {t("حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Employee Profile Sheet */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedEmployee && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl shrink-0">
                    {selectedEmployee.name.substring(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-xl truncate">{selectedEmployee.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{selectedEmployee.position} — {selectedEmployee.department}</p>
                    {getStatusBadge(selectedEmployee.status)}
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                  { icon: DollarSign, label: t("الراتب الأساسي", "Base Salary"), value: fmtCurrency(selectedEmployee.baseSalary), color: "text-primary" },
                  { icon: Hash, label: t("الحافز اليومي", "Daily Incentive"), value: selectedEmployee.dailyIncentive > 0 ? fmtCurrency(selectedEmployee.dailyIncentive) : "—", color: selectedEmployee.dailyIncentive > 0 ? "text-primary" : "text-muted-foreground" },
                  { icon: Clock, label: t("نوع الراتب", "Salary Type"), value: t(SALARY_LABELS[selectedEmployee.salaryType].ar, SALARY_LABELS[selectedEmployee.salaryType].en), color: "text-foreground" },
                  { icon: Phone, label: t("الهاتف", "Phone"), value: selectedEmployee.phone || "—", color: "text-muted-foreground" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <Card key={label} className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <p className={`font-bold text-sm ${color}`}>{value}</p>
                  </Card>
                ))}
              </div>

          <Card className="p-4 mb-6">
            <div className="flex justify-between items-center gap-2">
              <span className="font-semibold">{t("صافي الراتب", "Net Salary")}</span>
              <span className="text-xl font-bold text-primary text-right">
                {fmtCurrency(selectedEmployee.baseSalary + selectedEmployee.allowances + selectedEmployee.overtime - selectedEmployee.deductions - selectedEmployee.advances)}
              </span>
            </div>
          </Card>

          <Card className="p-4 mb-6">
            <div className="flex justify-between items-center gap-2">
              <span className="font-semibold">{t("رصيد الإجازات", "Leave Balance")}</span>
              <span className="text-xl font-bold text-chart-2 text-right">
                {getLeaveBalance(selectedEmployee.id, new Date().getFullYear())} {t("يوم", "days")}
              </span>
            </div>
          </Card>

          {selectedEmployee.dailyIncentive > 0 && (
            <Card className="p-4 mb-6 border-chart-3/20 bg-chart-3/5">
              <div className="flex justify-between items-center gap-2">
                <div>
                  <span className="font-semibold">{t("الحافز التراكمي", "Carried-over Incentive")}</span>
                  <p className="text-[10px] text-muted-foreground">
                    {t("الحافز غير المعتمد يترحل تلقائياً", "Unapproved incentive carries over")}
                  </p>
                </div>
                <span className="text-xl font-bold text-chart-3">
                  {fmtCurrency(computePendingIncentive(selectedEmployee.id))}
                </span>
              </div>
            </Card>
          )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button className="gap-2" onClick={() => { setProfileOpen(false); setLeaveOpen(true); }}>
                  <Calendar className="w-4 h-4" />{t("طلب إجازة", "Request Leave")}
                </Button>
                <Button variant="outline" className="gap-2">
                  <DollarSign className="w-4 h-4" />{t("طلب سلفة", "Request Advance")}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Leave Request Sheet */}
      <Sheet open={leaveOpen} onOpenChange={setLeaveOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("طلب إجازة", "Leave Request")}</SheetTitle>
            {selectedEmployee && <SheetDescription>{selectedEmployee.name}</SheetDescription>}
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("نوع الإجازة", "Leave Type")}</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger><SelectValue placeholder={t("اختر النوع", "Select type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">{t("اعتيادية", "Annual")}</SelectItem>
                  <SelectItem value="sick">{t("مرضية", "Sick")}</SelectItem>
                  <SelectItem value="unpaid">{t("بدون راتب", "Unpaid")}</SelectItem>
                  <SelectItem value="emergency">{t("طارئة", "Emergency")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label>{t("من تاريخ", "From Date")}</Label>
                <Input type="date" value={leaveFrom} onChange={e => setLeaveFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("إلى تاريخ", "To Date")}</Label>
                <Input type="date" value={leaveTo} onChange={e => setLeaveTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("سبب الإجازة", "Reason")}</Label>
              <Input placeholder={t("سبب الإجازة...", "Leave reason...")} value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
            </div>
            <AnimatePresence mode="wait">
              {leaveSubmitted ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary rounded-lg">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-medium">{t("تم إرسال طلب الإجازة!", "Leave request submitted!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex flex-col sm:flex-row gap-3">
                  <Button className="w-full sm:flex-1" onClick={handleLeaveSubmit} disabled={!leaveType || !leaveFrom || !leaveTo}>
                    {t("إرسال الطلب", "Submit Request")}
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setLeaveOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── HR Report Sheet ── */}
      <Sheet open={repOpen} onOpenChange={o => { setRepOpen(o); if (!o) { setRepGenerated(false); setRepDateMode("all"); setRepDateFrom(""); setRepDateTo(""); setRepDepartment(""); } }}>
        <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("تقرير الموارد البشرية", "HR Report")}</SheetTitle>
            <SheetDescription>{t("اختر الخيارات ثم أنشئ التقرير", "Choose options and generate the report")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            {/* Date Filter */}
            <div className="space-y-2">
              <Label>{t("نطاق التاريخ", "Date Range")}</Label>
              <Select value={repDateMode} onValueChange={v => { setRepDateMode(v as DateMode); setRepGenerated(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("كل الفترة", "All Period")}</SelectItem>
                  <SelectItem value="today">{t("اليوم فقط", "Today Only")}</SelectItem>
                  <SelectItem value="range">{t("نطاق مخصص", "Custom Range")}</SelectItem>
                </SelectContent>
              </Select>
              {repDateMode === "range" && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("من", "From")}</Label>
                    <Input type="date" value={repDateFrom} onChange={e => { setRepDateFrom(e.target.value); setRepGenerated(false); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("إلى", "To")}</Label>
                    <Input type="date" value={repDateTo} onChange={e => { setRepDateTo(e.target.value); setRepGenerated(false); }} />
                  </div>
                </div>
              )}
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <Label>{t("القسم", "Department")}</Label>
              <Select value={repDepartment} onValueChange={v => { setRepDepartment(v); setRepGenerated(false); }}>
                <SelectTrigger><SelectValue placeholder={t("جميع الأقسام", "All Departments")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("جميع الأقسام", "All Departments")}</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Sections Toggle */}
            <div className="space-y-3">
              <Label>{t("الأقسام المراد تضمينها", "Sections to Include")}</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={repSummary} onChange={e => setRepSummary(e.target.checked)} className="rounded border-border" />
                  {t("ملخص الموظفين", "Employee Summary")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={repEmployeeList} onChange={e => setRepEmployeeList(e.target.checked)} className="rounded border-border" />
                  {t("قائمة الموظفين", "Employee List")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={repContracts} onChange={e => setRepContracts(e.target.checked)} className="rounded border-border" />
                  {t("العقود المنتهية قريباً", "Expiring Contracts")}
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button className="w-full sm:flex-1" onClick={handleGenerateHRReport} disabled={repGenerating}>
                {repGenerating ? t("جارٍ الإنشاء...", "Generating...") : t("إنشاء التقرير", "Generate Report")}
              </Button>
              <Button variant="outline" className="w-full sm:flex-1 gap-2" onClick={handleDownloadHRPDF} disabled={!repGenerated}>
                <Download className="w-4 h-4" />{t("تحميل PDF", "Download PDF")}
              </Button>
            </div>

            {/* Success Message */}
            {repGenerated && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-primary/10 text-primary rounded-lg text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{t("تم إنشاء التقرير! يمكنك تحميله بصيغة PDF.", "Report generated! You can now download it as PDF.")}</span>
              </motion.div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
