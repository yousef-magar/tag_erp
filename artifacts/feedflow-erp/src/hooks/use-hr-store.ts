import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dexieStorage } from "@/lib/dexie-storage";
import { api } from "@/lib/api";
import { logActivity } from "./use-activity-log";

export type SalaryType = "monthly" | "weekly";
export type AttendanceStatus = "present" | "absent" | "late" | "deduction";

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  departments: string[];
  lateThresholdMinutes: number;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  department: string;
  position: string;
  salaryType: SalaryType;
  baseSalary: number;
  dailyIncentive: number;
  lateDeductionPct: number;
  status: string;
  allowances: number;
  overtime: number;
  deductions: number;
  advances: number;
  joinDate: string;
  notes: string;
  workStartTime: string;
  workEndTime: string;
  workHours: number;
  overtimeRate: number;
  commissionType: "pct" | "per_ton" | "tiered" | "none";
  commissionRate: number;
}

export type PayApprovalType = "salary_monthly" | "salary_weekly" | "incentive" | "commission";

export interface PayrollTransaction {
  id: string;
  year: number;
  month: number;
  weekNumber?: number;
  approvalType: PayApprovalType;
  approvedAt: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
  breakdown: {
    employeeId: string;
    name: string;
    dailyRate: number;
    presentDays: number;
    absentDays: number;
    grossPay: number;
    incentivePaid: number;
    advances: number;
    deductions: number;
    netPay: number;
  }[];
}

export const calcDailyRate = (emp: Employee) => Math.round(emp.baseSalary / 30);
export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export type PayrollResult = {
  dailyRate: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  deductionDays: number;
  grossPay: number;
  pendingIncentive: number;
};

export function effectiveDailyPay(dailyRate: number, status: AttendanceStatus, deductionAmt?: number, latePct?: number): number {
  switch (status) {
    case "present": return dailyRate;
    case "absent": return 0;
    case "late": return dailyRate * (1 - (latePct ?? 25) / 100);
    case "deduction": return Math.max(0, dailyRate - (deductionAmt || 0));
    default: return dailyRate;
  }
}

interface HRState {
  departments: string[];
  shifts: Shift[];
  employees: Employee[];
  attendance: Record<string, Record<string, AttendanceStatus>>;
  incentiveApproved: Record<string, Record<string, boolean>>;
  commissionApproved: Record<string, Record<string, boolean>>;
  payrollTransactions: PayrollTransaction[];
  leaveBalance: Record<string, Record<string, number>>;
  attendanceReasons: Record<string, Record<string, string>>;
  attendanceDeductions: Record<string, Record<string, number>>;
  checkIn: Record<string, Record<string, string>>;
  checkOut: Record<string, Record<string, string>>;
  addShift: (shift: Omit<Shift, "id">) => void;
  removeShift: (id: string) => void;
  updateShift: (id: string, updates: Partial<Shift>) => void;
  addDepartment: (name: string) => void;
  removeDepartment: (name: string) => void;
  addEmployee: (emp: Omit<Employee, "id">) => Promise<Employee | undefined>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<Employee | undefined>;
  deleteEmployee: (id: string) => Promise<void>;
  setAttendance: (employeeId: string, date: string, status: AttendanceStatus) => void;
  setAttendanceFull: (employeeId: string, date: string, status: AttendanceStatus, reason?: string, deductionAmount?: number) => void;
  setCheckIn: (employeeId: string, date: string, time: string) => void;
  setCheckOut: (employeeId: string, date: string, time: string) => void;
  computeOvertime: (emp: Employee, date: string) => { hours: number; pay: number };
  getAttendance: (employeeId: string, date: string) => AttendanceStatus;
  resetMonthAttendance: (year: number, month: number) => void;
  setIncentiveApproved: (employeeId: string, date: string, approved: boolean) => void;
  computePendingIncentive: (employeeId: string) => number;
  computePendingCommission: (employeeId: string, invoices: { id: string; total: number; items: { qtyTons: number }[]; marketerId?: string }[]) => number;
  approveMarketerCommission: (employeeId: string, year: number, month: number, invoices: { id: string; total: number; items: { qtyTons: number }[]; marketerId?: string }[]) => PayrollTransaction;
  computeEmployeePayroll: (emp: Employee, year: number, month: number, monthStartDay?: number, endDay?: number) => PayrollResult;
  computeWeekPayroll: (emp: Employee, year: number, month: number, weekNumber: number, weekStartDay?: number, endDay?: number) => { dailyRate: number; presentDays: number; absentDays: number; grossPay: number; dayNumbers: number[] };
  approveDailyIncentive: (employeeId: string, year: number, month: number) => PayrollTransaction;
  approveMonthlySalary: (employeeId: string, year: number, month: number, monthStartDay?: number, endDay?: number) => PayrollTransaction;
  approveWeeklySalary: (employeeId: string, year: number, month: number, weekNumber: number, weekStartDay?: number, endDay?: number) => PayrollTransaction;
  approvePayroll: (year: number, month: number) => PayrollTransaction;
  accrueAnnualLeave: (year: number) => void;
  deductLeave: (employeeId: string, year: number, days: number) => void;
  getLeaveBalance: (employeeId: string, year: number) => number;
  exportedPayrollEntries: { id: string; date: string; month: number; year: number; totalAmount: number; description: string; }[];
  exportPayrollToAccounting: (year: number, month: number) => void;
}

const DEFAULT_DEPARTMENTS: string[] = [];

export const useHRStore = create<HRState>()(
  persist(
    (set, get) => {
      return {
        departments: DEFAULT_DEPARTMENTS,
        shifts: [],
        employees: [],
        attendance: {},
        incentiveApproved: {},
        payrollTransactions: [],
        leaveBalance: {},
        exportedPayrollEntries: [],
        attendanceReasons: {},
        attendanceDeductions: {},
        checkIn: {},
        checkOut: {},
        commissionApproved: {},

        addShift: (shift) => set((s) => {
          const newShift = { ...shift, id: `S${Date.now()}` };
          logActivity("hr", "create", `إضافة وردية: ${newShift.name}`, `Add shift: ${newShift.name}`);
          return { shifts: [...s.shifts, newShift] };
        }),
        removeShift: (id) => set((s) => {
          logActivity("hr", "delete", `حذف الوردية`, `Delete shift`, id);
          return { shifts: s.shifts.filter((sh) => sh.id !== id) };
        }),
        updateShift: (id, updates) => set((s) => {
          logActivity("hr", "update", `تحديث الوردية: ${id}`, `Update shift: ${id}`, id);
          return { shifts: s.shifts.map((sh) => sh.id === id ? { ...sh, ...updates } : sh) };
        }),

        addDepartment: (name) =>
          set((s) => {
            if (s.departments.includes(name)) return s;
            return { departments: [...s.departments, name] };
          }),

        removeDepartment: (name) =>
          set((s) => ({
            departments: s.departments.filter((d) => d !== name),
          })),

        addEmployee: async (emp) => {
          const newId = `E${Date.now()}`;
          const employee: Employee = { ...emp, id: newId };
          const now = new Date();
          const y = now.getFullYear();
          const m = now.getMonth() + 1;
          const total = daysInMonth(y, m);
          const today = now.getDate();
          const joinDate = emp.joinDate ? new Date(emp.joinDate) : now;
          const joinDay = Math.max(1, joinDate.getDate());
          const startDay = joinDate.getFullYear() === y && joinDate.getMonth() + 1 === m ? joinDay : 1;
          const empAttendance: Record<string, AttendanceStatus> = {};
          const empIncentive: Record<string, boolean> = {};
          for (let d = startDay; d <= Math.min(today, total); d++) {
            const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            empAttendance[date] = "present";
            empIncentive[date] = false;
          }
          set((s) => ({
            employees: [...s.employees, employee],
            attendance: { ...s.attendance, [newId]: empAttendance },
            incentiveApproved: { ...s.incentiveApproved, [newId]: empIncentive },
            leaveBalance: { ...s.leaveBalance, [newId]: { [String(y)]: 21 } },
          }));
          logActivity("hr", "create", `إضافة موظف: ${employee.name}`, `Add employee: ${employee.name}`, employee.id);
          api.employees.create(employee).catch(() => {});
          return employee;
        },

        updateEmployee: async (id, updates) => {
          const existing = get().employees.find(e => e.id === id);
          const merged = existing ? { ...existing, ...updates } : ({ ...updates, id } as Employee);
          set((s) => ({ employees: s.employees.map((e) => e.id === id ? merged : e) }));
          logActivity("hr", "update", `تحديث بيانات الموظف: ${id}`, `Update employee: ${id}`, id);
          api.employees.update(id, updates).catch(() => {});
          return merged;
        },

        deleteEmployee: async (id) => {
          set((s) => ({ employees: s.employees.filter((e) => e.id !== id) }));
          logActivity("hr", "delete", `حذف الموظف: ${id}`, `Delete employee: ${id}`, id);
          api.employees.delete(id).catch(() => {});
        },

        setAttendance: (employeeId, date, status) =>
          set((s) => ({
            attendance: {
              ...s.attendance,
              [employeeId]: { ...s.attendance[employeeId], [date]: status },
            },
          })),

        setAttendanceFull: (employeeId, date, status, reason, deductionAmount) =>
          set((s) => ({
            attendance: {
              ...s.attendance,
              [employeeId]: { ...s.attendance[employeeId], [date]: status },
            },
            attendanceReasons: reason !== undefined ? {
              ...s.attendanceReasons,
              [employeeId]: { ...(s.attendanceReasons[employeeId] || {}), [date]: reason },
            } : s.attendanceReasons,
            attendanceDeductions: deductionAmount !== undefined ? {
              ...s.attendanceDeductions,
              [employeeId]: { ...(s.attendanceDeductions[employeeId] || {}), [date]: deductionAmount },
            } : s.attendanceDeductions,
          })),

        getAttendance: (employeeId, date) => {
          const emp = get().attendance[employeeId];
          const today = new Date();
          const dateObj = new Date(date);
          if (dateObj > today) return "present";
          return emp?.[date] ?? "present";
        },

        setCheckIn: (employeeId, date, time) =>
          set((s) => ({
            checkIn: {
              ...s.checkIn,
              [employeeId]: { ...(s.checkIn[employeeId] || {}), [date]: time },
            },
          })),

        setCheckOut: (employeeId, date, time) =>
          set((s) => ({
            checkOut: {
              ...s.checkOut,
              [employeeId]: { ...(s.checkOut[employeeId] || {}), [date]: time },
            },
          })),

        computeOvertime: (emp, date) => {
          const state = get();
          const ci = state.checkIn[emp.id]?.[date];
          const co = state.checkOut[emp.id]?.[date];
          if (!ci || !co) return { hours: 0, pay: 0 };
          const [ciH, ciM] = ci.split(":").map(Number);
          const [coH, coM] = co.split(":").map(Number);
          const worked = (coH + coM / 60) - (ciH + ciM / 60);
          const normal = emp.workHours || 8;
          const extra = Math.max(0, worked - normal);
          const hourlyRate = calcDailyRate(emp) / normal;
          const rate = emp.overtimeRate || 1.5;
          const pay = extra * hourlyRate * rate;
          return { hours: Math.round(extra * 100) / 100, pay: Math.round(pay) };
        },

        resetMonthAttendance: (year, month) => {
          const state = get();
          const total = daysInMonth(year, month);
          const updatedA = { ...state.attendance };
          const updatedI = { ...state.incentiveApproved };
          for (const emp of state.employees) {
            if (!updatedA[emp.id]) updatedA[emp.id] = {};
            if (!updatedI[emp.id]) updatedI[emp.id] = {};
            const joinDate = emp.joinDate ? new Date(emp.joinDate) : null;
            const startDay = joinDate && joinDate.getFullYear() === year && joinDate.getMonth() + 1 === month ? joinDate.getDate() : 1;
            const lastMonthDay = daysInMonth(year, month);
          for (let d = startDay; d <= lastMonthDay; d++) {
              const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              updatedA[emp.id][date] = "present";
              updatedI[emp.id][date] = true;
            }
          }
          set({ attendance: updatedA, incentiveApproved: updatedI });
        },

        setIncentiveApproved: (employeeId, date, approved) =>
          set((s) => ({
            incentiveApproved: {
              ...s.incentiveApproved,
              [employeeId]: { ...s.incentiveApproved[employeeId], [date]: approved },
            },
          })),

        computePendingIncentive: (employeeId) => {
          const state = get();
          const emp = state.employees.find((e) => e.id === employeeId);
          if (!emp || !emp.dailyIncentive) return 0;
          let total = 0;
          const empAttendance = state.attendance[employeeId] || {};
          const empIncentive = state.incentiveApproved[employeeId] || {};
          for (const [date, status] of Object.entries(empAttendance)) {
            if (status === "present" && empIncentive[date] === false) {
              total += emp.dailyIncentive;
            }
          }
          return total;
        },

        computePendingCommission: (employeeId, invoices) => {
          const state = get();
          const emp = state.employees.find((e) => e.id === employeeId);
          if (!emp || emp.commissionType === "none") return 0;
          const approved = state.commissionApproved[employeeId] || {};
          let total = 0;
          for (const inv of invoices) {
            if (inv.marketerId !== employeeId) continue;
            if (approved[inv.id]) continue;
            if (emp.commissionType === "pct") {
              total += inv.total * (emp.commissionRate / 100);
            } else if (emp.commissionType === "per_ton") {
              const tons = inv.items.reduce((s, i) => s + i.qtyTons, 0);
              total += tons * emp.commissionRate;
            } else if (emp.commissionType === "tiered") {
              total += inv.total * (emp.commissionRate / 100);
            }
          }
          return total;
        },

        approveMarketerCommission: (employeeId, year, month, invoices) => {
          const state = get();
          const emp = state.employees.find((e) => e.id === employeeId);
          if (!emp) throw new Error("Employee not found");
          const pendingAmount = state.computePendingCommission(employeeId, invoices);
          if (pendingAmount <= 0) throw new Error("No pending commission");
          const invoicesToApprove = invoices.filter(i => i.marketerId === employeeId && !state.commissionApproved[employeeId]?.[i.id]);
          const tx: PayrollTransaction = {
            id: `COMM-${employeeId}-${year}-${String(month).padStart(2, "0")}-${Date.now()}`,
            year, month,
            approvalType: "commission",
            approvedAt: new Date().toISOString(),
            totalGross: pendingAmount,
            totalDeductions: 0,
            totalNet: pendingAmount,
            employeeCount: 1,
            breakdown: [{
              employeeId: emp.id, name: emp.name,
              dailyRate: 0, presentDays: 0, absentDays: 0,
              grossPay: pendingAmount, incentivePaid: 0,
              advances: 0, deductions: 0, netPay: pendingAmount,
            }],
          };
          set((s) => {
            const updated = { ...s.commissionApproved };
            if (!updated[employeeId]) updated[employeeId] = {};
            updated[employeeId] = { ...updated[employeeId] };
            for (const inv of invoicesToApprove) {
              updated[employeeId][inv.id] = true;
            }
            const expEntry = { id: `PAYROLL-${tx.id}`, date: new Date().toISOString().split("T")[0], month, year, totalAmount: tx.totalNet, description: `${emp.name} - عمولة` };
            return {
              payrollTransactions: [...s.payrollTransactions, tx],
              commissionApproved: updated,
              exportedPayrollEntries: [...s.exportedPayrollEntries, expEntry],
            };
          });
          return tx;
        },

        computeEmployeePayroll: (emp, year, month, monthStartDay = 1, endDay) => {
          const state = get();
          const total = daysInMonth(year, month);
          const lastDay = endDay ?? total;
          const dailyRate = calcDailyRate(emp);
          const joinDate = emp.joinDate ? new Date(emp.joinDate) : null;
          const joinBased = joinDate && joinDate.getFullYear() === year && joinDate.getMonth() + 1 === month ? joinDate.getDate() : 1;
          const startDay = Math.max(joinBased, monthStartDay);
          let presentDays = 0, absentDays = 0, lateDays = 0, deductionDays = 0;
          let totalPay = 0, overtimePay = 0;
          for (let d = startDay; d <= lastDay; d++) {
            const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const a = state.attendance[emp.id]?.[date] ?? "present";
            const dedAmt = state.attendanceDeductions?.[emp.id]?.[date];
            const lpct = emp.lateDeductionPct ?? 0;
            if (a === "present") { presentDays++; totalPay += dailyRate; }
            else if (a === "absent") { absentDays++; }
            else if (a === "late") { lateDays++; totalPay += dailyRate * (1 - lpct / 100); }
            else if (a === "deduction") { deductionDays++; totalPay += Math.max(0, dailyRate - (dedAmt || 0)); }
            else { presentDays++; totalPay += dailyRate; }
            const ot = state.computeOvertime(emp, date);
            if (ot.pay > 0) { totalPay += ot.pay; overtimePay += ot.pay; }
          }
          const pendingInc = state.computePendingIncentive(emp.id);
          const grossPay = totalPay + pendingInc;
          return { dailyRate, presentDays, absentDays, lateDays, deductionDays, grossPay, pendingIncentive: pendingInc };
        },

        computeWeekPayroll: (emp, year, month, weekNumber, weekStartDay = 6, endDay) => {
          const state = get();
          const dailyRate = calcDailyRate(emp);
          const joinDate = emp.joinDate ? new Date(emp.joinDate) : null;
          const joinStart = joinDate && joinDate.getFullYear() === year && joinDate.getMonth() + 1 === month ? joinDate.getDate() : 1;
          const total = daysInMonth(year, month);
          // Find first occurrence of weekStartDay in this month
          const firstDow = new Date(year, month - 1, 1).getDay();
          const firstStartDay = firstDow === weekStartDay ? 1 : ((weekStartDay - firstDow + 7) % 7) + 1;
          // Week N: starts at firstStartDay + (weekNumber - 1) * 7, exactly 7 days
          const startDay = Math.max(firstStartDay + (weekNumber - 1) * 7, joinStart);
          const weekEnd = Math.min(startDay + 6, total);
          const cappedEnd = endDay !== undefined ? Math.min(endDay, weekEnd) : weekEnd;
          const dayNumbers: number[] = [];
          let presentDays = 0, absentDays = 0, lateDays = 0, deductionDays = 0;
          let totalPay = 0;
          for (let d = startDay; d <= cappedEnd; d++) {
            dayNumbers.push(d);
            const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const a = state.attendance[emp.id]?.[date] ?? "present";
            const dedAmt = state.attendanceDeductions?.[emp.id]?.[date];
            const lpct = emp.lateDeductionPct ?? 0;
            if (a === "present") { presentDays++; totalPay += dailyRate; }
            else if (a === "absent") { absentDays++; }
            else if (a === "late") { lateDays++; totalPay += dailyRate * (1 - lpct / 100); }
            else if (a === "deduction") { deductionDays++; totalPay += Math.max(0, dailyRate - (dedAmt || 0)); }
            else { presentDays++; totalPay += dailyRate; }
            const ot = state.computeOvertime(emp, date);
            if (ot.pay > 0) totalPay += ot.pay;
          }
          const grossPay = totalPay;
          return { dailyRate, presentDays, absentDays, lateDays, deductionDays, grossPay, dayNumbers };
        },

        approveDailyIncentive: (employeeId, year, month) => {
          const state = get();
          const emp = state.employees.find((e) => e.id === employeeId);
          if (!emp) throw new Error("Employee not found");
          const incentiveAmount = state.computePendingIncentive(employeeId);
          if (incentiveAmount <= 0) throw new Error("No pending incentive");
          const netPay = incentiveAmount;
          const tx: PayrollTransaction = {
            id: `INC-${employeeId}-${year}-${String(month).padStart(2, "0")}-${Date.now()}`,
            year, month,
            approvalType: "incentive",
            approvedAt: new Date().toISOString(),
            totalGross: incentiveAmount,
            totalDeductions: 0,
            totalNet: netPay,
            employeeCount: 1,
            breakdown: [{
              employeeId: emp.id, name: emp.name,
              dailyRate: 0, presentDays: 0, absentDays: 0,
              grossPay: incentiveAmount, incentivePaid: incentiveAmount,
              advances: 0, deductions: 0, netPay,
            }],
          };
          set((s) => {
            const updatedI = { ...s.incentiveApproved };
            if (!updatedI[employeeId]) updatedI[employeeId] = {};
            updatedI[employeeId] = { ...updatedI[employeeId] };
            for (const [date, status] of Object.entries(s.attendance[employeeId] || {})) {
              if (status === "present" && (updatedI[employeeId][date] === false || updatedI[employeeId][date] === undefined)) {
                updatedI[employeeId][date] = true;
              }
            }
            const expEntry = { id: `PAYROLL-${tx.id}`, date: new Date().toISOString().split("T")[0], month, year, totalAmount: tx.totalNet, description: `${emp.name} - حافز` };
            return {
              payrollTransactions: [...s.payrollTransactions, tx],
              incentiveApproved: updatedI,
              exportedPayrollEntries: [...s.exportedPayrollEntries, expEntry],
            };
          });
          return tx;
        },

        approveMonthlySalary: (employeeId, year, month, monthStartDay = 1, endDay) => {
          const state = get();
          const emp = state.employees.find((e) => e.id === employeeId);
          if (!emp) throw new Error("Employee not found");
          if (emp.salaryType !== "monthly") throw new Error("Employee is not monthly");
          const total = daysInMonth(year, month);
          const lastDay = endDay ?? total;
          const dailyRate = calcDailyRate(emp);
          const joinDate = emp.joinDate ? new Date(emp.joinDate) : null;
          const joinBased = joinDate && joinDate.getFullYear() === year && joinDate.getMonth() + 1 === month ? joinDate.getDate() : 1;
          const startDay = Math.max(joinBased, monthStartDay);
          let presentDays = 0, absentDays = 0, lateDays = 0, deductionDays = 0;
          let totalPay = 0;
          for (let d = startDay; d <= lastDay; d++) {
            const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const a = state.attendance[emp.id]?.[date] ?? "present";
            const dedAmt = state.attendanceDeductions?.[emp.id]?.[date];
            const lpct = emp.lateDeductionPct ?? 0;
            if (a === "present") { presentDays++; totalPay += dailyRate; }
            else if (a === "absent") { absentDays++; }
            else if (a === "late") { lateDays++; totalPay += dailyRate * (1 - lpct / 100); }
            else if (a === "deduction") { deductionDays++; totalPay += Math.max(0, dailyRate - (dedAmt || 0)); }
            else { presentDays++; totalPay += dailyRate; }
            const ot = state.computeOvertime(emp, date);
            if (ot.pay > 0) totalPay += ot.pay;
          }
          const pendingInc = state.computePendingIncentive(employeeId);
          const grossPay = totalPay + pendingInc;
          const netPay = Math.max(0, grossPay - emp.advances - emp.deductions);
          const tx: PayrollTransaction = {
            id: `MONTHLY-${employeeId}-${year}-${String(month).padStart(2, "0")}-${Date.now()}`,
            year, month,
            approvalType: "salary_monthly",
            approvedAt: new Date().toISOString(),
            totalGross: grossPay,
            totalDeductions: emp.advances + emp.deductions,
            totalNet: netPay,
            employeeCount: 1,
            breakdown: [{
              employeeId: emp.id, name: emp.name,
              dailyRate, presentDays, absentDays,
              grossPay, incentivePaid: pendingInc,
              advances: emp.advances, deductions: emp.deductions, netPay,
            }],
          };
          set((s) => {
            const updatedI = { ...s.incentiveApproved };
            if (pendingInc > 0) {
              if (!updatedI[employeeId]) updatedI[employeeId] = {};
              updatedI[employeeId] = { ...updatedI[employeeId] };
              for (const [date, status] of Object.entries(s.attendance[employeeId] || {})) {
                if (status === "present" && (updatedI[employeeId][date] === false || updatedI[employeeId][date] === undefined)) {
                  updatedI[employeeId][date] = true;
                }
              }
            }
            const expEntry = { id: `PAYROLL-${tx.id}`, date: new Date().toISOString().split("T")[0], month, year, totalAmount: tx.totalNet, description: `${emp.name} - راتب شهري` };
            return {
              payrollTransactions: [...s.payrollTransactions, tx],
              employees: s.employees.map((e) =>
                e.id === employeeId ? { ...e, advances: 0, overtime: 0, allowances: 0, deductions: 0 } : e
              ),
              incentiveApproved: updatedI,
              exportedPayrollEntries: [...s.exportedPayrollEntries, expEntry],
            };
          });
          return tx;
        },

        approveWeeklySalary: (employeeId, year, month, weekNumber, weekStartDay = 6, endDay) => {
          const state = get();
          const emp = state.employees.find((e) => e.id === employeeId);
          if (!emp) throw new Error("Employee not found");
          if (emp.salaryType !== "weekly") throw new Error("Employee is not weekly");
          const { dailyRate, presentDays, absentDays, grossPay, dayNumbers } = state.computeWeekPayroll(emp, year, month, weekNumber, weekStartDay, endDay);
          const pendingInc = state.computePendingIncentive(employeeId);
          const grossWithInc = grossPay + pendingInc;
          const netPay = Math.max(0, grossWithInc - emp.advances - emp.deductions);
          const tx: PayrollTransaction = {
            id: `WEEKLY-${employeeId}-${year}-${String(month).padStart(2, "0")}-W${weekNumber}-${Date.now()}`,
            year, month, weekNumber,
            approvalType: "salary_weekly",
            approvedAt: new Date().toISOString(),
            totalGross: grossWithInc,
            totalDeductions: emp.advances + emp.deductions,
            totalNet: netPay,
            employeeCount: 1,
            breakdown: [{
              employeeId: emp.id, name: emp.name,
              dailyRate, presentDays, absentDays,
              grossPay, incentivePaid: pendingInc,
              advances: emp.advances, deductions: emp.deductions, netPay,
            }],
          };
          set((s) => {
            const updatedI = { ...s.incentiveApproved };
            if (pendingInc > 0) {
              if (!updatedI[employeeId]) updatedI[employeeId] = {};
              updatedI[employeeId] = { ...updatedI[employeeId] };
              for (const [date, status] of Object.entries(s.attendance[employeeId] || {})) {
                if (status === "present" && (updatedI[employeeId][date] === false || updatedI[employeeId][date] === undefined)) {
                  updatedI[employeeId][date] = true;
                }
              }
            }
            const expEntry = { id: `PAYROLL-${tx.id}`, date: new Date().toISOString().split("T")[0], month, year, totalAmount: tx.totalNet, description: `${emp.name} - راتب أسبوعي W${weekNumber}` };
            return {
              payrollTransactions: [...s.payrollTransactions, tx],
              employees: s.employees.map((e) =>
                e.id === employeeId ? { ...e, advances: 0, overtime: 0, allowances: 0, deductions: 0 } : e
              ),
              incentiveApproved: updatedI,
              exportedPayrollEntries: [...s.exportedPayrollEntries, expEntry],
            };
          });
          return tx;
        },

        approvePayroll: (year, month, monthStartDay = 1) => {
          const state = get();
          const breakdown: PayrollTransaction["breakdown"] = [];
          let totalGross = 0, totalDeductions = 0, totalNet = 0;
          for (const emp of state.employees) {
            const { dailyRate, presentDays, absentDays, grossPay, pendingIncentive } = state.computeEmployeePayroll(emp, year, month, monthStartDay);
            const netPay = Math.max(0, grossPay - emp.advances - emp.deductions);
            totalGross += grossPay;
            totalDeductions += emp.advances + emp.deductions;
            totalNet += netPay;
            breakdown.push({
              employeeId: emp.id, name: emp.name, dailyRate,
              presentDays, absentDays, grossPay,
              incentivePaid: pendingIncentive,
              advances: emp.advances, deductions: emp.deductions, netPay,
            });
          }
          const tx: PayrollTransaction = {
            id: `PR-ALL-${year}-${String(month).padStart(2, "0")}-${Date.now()}`,
            year, month,
            approvalType: "salary_monthly",
            approvedAt: new Date().toISOString(),
            totalGross, totalDeductions, totalNet,
            employeeCount: state.employees.length,
            breakdown,
          };
          set((s) => {
            // Mark all pending incentives as approved for all employees
            const updatedI = { ...s.incentiveApproved };
            for (const emp of s.employees) {
              if (updatedI[emp.id]) {
                updatedI[emp.id] = { ...updatedI[emp.id] };
                for (const [date, status] of Object.entries(s.attendance[emp.id] || {})) {
                  if (status === "present" && updatedI[emp.id][date] === false) {
                    updatedI[emp.id][date] = true;
                  }
                }
              }
            }
            return {
              payrollTransactions: [...s.payrollTransactions, tx],
              employees: s.employees.map((e) => ({
                ...e, advances: 0, overtime: 0, allowances: 0, deductions: 0,
              })),
              incentiveApproved: updatedI,
            };
          });
          logActivity("payroll", "create", `اعتماد كشوف الرواتب`, `Approve payroll`);
          return tx;
        },

        accrueAnnualLeave: (year) => {
          const state = get();
          const yearStr = String(year);
          const updated = { ...state.leaveBalance };
          for (const emp of state.employees) {
            if (!updated[emp.id]) updated[emp.id] = {};
            updated[emp.id][yearStr] = (updated[emp.id][yearStr] || 0) + 21;
          }
          set({ leaveBalance: updated });
        },

        deductLeave: (employeeId, year, days) => {
          set((s) => {
            const yearStr = String(year);
            const current = s.leaveBalance[employeeId]?.[yearStr] ?? 0;
            const updated = {
              ...s.leaveBalance,
              [employeeId]: {
                ...s.leaveBalance[employeeId],
                [yearStr]: Math.max(0, current - days),
              },
            };
            return { leaveBalance: updated };
          });
        },

        getLeaveBalance: (employeeId, year) => {
          return get().leaveBalance[employeeId]?.[String(year)] ?? 0;
        },

        exportPayrollToAccounting: (year, month) => {
          const state = get();
          const monthLabel = `${String(month).padStart(2, "0")}/${year}`;
          const entries: { employeeId: string; name: string; amount: number; type: string; }[] = [];
          let totalAmount = 0;

          for (const tx of state.payrollTransactions) {
            if (tx.year !== year || tx.month !== month) continue;
            for (const b of tx.breakdown) {
              const typeLabel =
                tx.approvalType === "salary_monthly" ? "راتب شهري"
                : tx.approvalType === "salary_weekly" ? `راتب أسبوعي (أسبوع ${tx.weekNumber})`
                : "حافز يومي";
              entries.push({ employeeId: b.employeeId, name: b.name, amount: b.netPay, type: typeLabel });
              totalAmount += b.netPay;
            }
          }

          if (entries.length === 0) return;

          const expenseEntry = {
            id: `PAYROLL-${year}-${String(month).padStart(2, "0")}-${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            month,
            year,
            totalAmount,
            description: `رواتب شهر ${monthLabel}`,
          };

          set((s) => ({
            exportedPayrollEntries: [...s.exportedPayrollEntries, expenseEntry],
          }));
          logActivity("payroll", "create", `تصدير الرواتب للحسابات`, `Export payroll to accounting`);
        },
      };
    },
    {
      name: "ff-hr-store",
      storage: dexieStorage,
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Partial<HRState> & { shiftCount?: number };
        if (version < 1) {
          if (!state.shifts) {
            const count = state.shiftCount ?? 1;
            const arabicNums = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
            state.shifts = Array.from({ length: count }, (_, i) => ({
              id: `S${i + 1}`,
              name: `الشيفت ${arabicNums[i] || i + 1}`,
              startTime: "08:00",
              endTime: "16:00",
              departments: [state.departments?.[0] || "الإنتاج"],
              lateThresholdMinutes: 15,
            }));
          } else {
            const arabicNums = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
            state.shifts = state.shifts.map((sh: any, i) => ({
              ...sh,
              name: arabicNums[i] ? `الشيفت ${arabicNums[i]}` : sh.name,
              departments: Array.isArray(sh.departments) ? sh.departments : [sh.department || state.departments?.[0] || "الإنتاج"].filter(Boolean),
            }));
          }
          delete (state as any).shiftCount;
        }
        if (version < 2 && state.shifts) {
          state.shifts = state.shifts.map((sh: any) => ({
            ...sh,
            lateThresholdMinutes: sh.lateThresholdMinutes ?? 15,
          }));
        }
        return state as HRState;
      },
    }
  )
);
