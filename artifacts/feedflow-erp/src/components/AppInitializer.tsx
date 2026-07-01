import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/hooks/use-app-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useSalesStore } from "@/hooks/use-sales-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { useFleetStore } from "@/hooks/use-fleet-store";
import { useProcurementStore } from "@/hooks/use-procurement-store";
import { usePricingStore } from "@/hooks/use-pricing-store";
import { useActivityLog } from "@/hooks/use-activity-log";
import { useNotificationStore } from "@/hooks/use-notification-store";

export function AppInitializer({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadAllData();
  }, []);

  return <>{children}</>;
}

async function loadAllData() {
  try {
    const [
      customers, invoices, returns, payments,
      employees, shifts, attendance, payroll,
      vehicles, shipments,
      suppliers, orders, purchaseReturns, supplierPayments,
      prices, alerts, groups,
      materials, inventory, formulas, productionOrders, warehouseConfigs,
      subAccounts, bankAccounts, walletAccounts,
      activityEntries, notifications,
    ] = await Promise.all([
      safeFetch(api.customers.list()),
      safeFetch(api.invoices.list()),
      safeFetch(api.returns.list()),
      safeFetch(api.payments.list()),
      safeFetch(api.employees.list()),
      safeFetch(api.shifts.list()),
      safeFetch(api.attendance.list()),
      safeFetch(api.payroll.list()),
      safeFetch(api.vehicles.list()),
      safeFetch(api.shipments.list()),
      safeFetch(api.suppliers.list()),
      safeFetch(api.purchaseOrders.list()),
      safeFetch(api.purchaseReturns.list()),
      safeFetch(api.supplierPayments.list()),
      safeFetch(api.productPrices.list()),
      safeFetch(api.pricingAlerts.list()),
      safeFetch(api.productGroups.list()),
      safeFetch(api.materials.list()),
      safeFetch(api.inventory.list()),
      safeFetch(api.formulas.list()),
      safeFetch(api.productionOrders.list()),
      safeFetch(api.warehouseConfigs.list()),
      safeFetch(api.subAccounts.list()),
      safeFetch(api.bankAccounts.list()),
      safeFetch(api.walletAccounts.list()),
      safeFetch(api.activityLog.list()),
      safeFetch(api.notifications.list()),
    ]);

    if (customers) useSalesStore.setState({ customers });
    if (invoices) useSalesStore.setState({ invoices });
    if (returns) useSalesStore.setState({ returns });
    if (payments) useSalesStore.setState({ payments });
    if (employees) useHRStore.setState({ employees });
    if (shifts) useHRStore.setState({ shifts });
    if (attendance) {
      const attMap: Record<string, Record<string, any>> = {};
      const reasonMap: Record<string, Record<string, string>> = {};
      const deductionMap: Record<string, Record<string, number>> = {};
      for (const a of attendance as any[]) {
        if (!attMap[a.employeeId]) attMap[a.employeeId] = {};
        attMap[a.employeeId][a.date] = a.status;
        if (a.reason) {
          if (!reasonMap[a.employeeId]) reasonMap[a.employeeId] = {};
          reasonMap[a.employeeId][a.date] = a.reason;
        }
        if (a.deductionAmount) {
          if (!deductionMap[a.employeeId]) deductionMap[a.employeeId] = {};
          deductionMap[a.employeeId][a.date] = Number(a.deductionAmount);
        }
      }
      useHRStore.setState({ attendance: attMap, attendanceReasons: reasonMap, attendanceDeductions: deductionMap });
    }
    if (payroll) useHRStore.setState({ payrollTransactions: payroll });
    if (vehicles) useFleetStore.setState({ vehicles });
    if (shipments) useFleetStore.setState({ shipments });
    if (suppliers) useProcurementStore.setState({ suppliers });
    if (orders) useProcurementStore.setState({ orders });
    if (purchaseReturns) useProcurementStore.setState({ returns: purchaseReturns });
    if (supplierPayments) useProcurementStore.setState({ payments: supplierPayments });
    if (prices) usePricingStore.setState({ productPrices: prices });
    if (alerts) usePricingStore.setState({ pricingAlerts: alerts });
    if (inventory) useProductionStore.setState({ inventory });
    if (productionOrders) useProductionStore.setState({ orders: productionOrders });
    if (warehouseConfigs) useProductionStore.setState({ warehouseConfigs });
    if (subAccounts) useAppStore.setState({ subAccounts });
    if (bankAccounts) useAppStore.setState({ bankAccounts });
    if (walletAccounts) useAppStore.setState({ walletAccounts });
    if (activityEntries) {
      const cleaned = activityEntries.filter((e: any) => e.user !== "hidden-owner" && !e.arDescription?.includes("yousef.magar@gmail.com") && !e.enDescription?.includes("yousef.magar@gmail.com"));
      useActivityLog.setState({ entries: cleaned });
    }
    if (notifications) useNotificationStore.setState({ notifications });
  } catch (err) {
    console.warn("Failed to load data from server, using local storage:", err);
  }
}

async function safeFetch<T>(promise: Promise<T>): Promise<T | null> {
  try { return await promise; } catch { return null; }
}
