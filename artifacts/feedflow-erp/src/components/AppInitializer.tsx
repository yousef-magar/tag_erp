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

    if (customers && customers.length > 0 && useSalesStore.getState().customers.length === 0) useSalesStore.setState({ customers });
    if (invoices && invoices.length > 0 && useSalesStore.getState().invoices.length === 0) useSalesStore.setState({ invoices });
    if (returns && returns.length > 0 && useSalesStore.getState().returns.length === 0) useSalesStore.setState({ returns });
    if (payments && payments.length > 0 && useSalesStore.getState().payments.length === 0) useSalesStore.setState({ payments });
    if (employees && employees.length > 0 && useHRStore.getState().employees.length === 0) useHRStore.setState({ employees });
    if (shifts && shifts.length > 0 && useHRStore.getState().shifts.length === 0) useHRStore.setState({ shifts });
    if (attendance && Object.keys(useHRStore.getState().attendance).length === 0) {
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
    if (payroll && payroll.length > 0 && useHRStore.getState().payrollTransactions.length === 0) useHRStore.setState({ payrollTransactions: payroll });
    if (vehicles && vehicles.length > 0 && useFleetStore.getState().vehicles.length === 0) useFleetStore.setState({ vehicles });
    if (shipments && shipments.length > 0 && useFleetStore.getState().shipments.length === 0) useFleetStore.setState({ shipments });
    if (suppliers && suppliers.length > 0 && useProcurementStore.getState().suppliers.length === 0) useProcurementStore.setState({ suppliers });
    if (orders && orders.length > 0 && useProcurementStore.getState().orders.length === 0) useProcurementStore.setState({ orders });
    if (purchaseReturns && purchaseReturns.length > 0 && useProcurementStore.getState().returns.length === 0) useProcurementStore.setState({ returns: purchaseReturns });
    if (supplierPayments && supplierPayments.length > 0 && useProcurementStore.getState().payments.length === 0) useProcurementStore.setState({ payments: supplierPayments });
    if (prices && prices.length > 0 && usePricingStore.getState().productPrices.length === 0) usePricingStore.setState({ productPrices: prices });
    if (alerts && alerts.length > 0 && usePricingStore.getState().pricingAlerts.length === 0) usePricingStore.setState({ pricingAlerts: alerts });
    if (inventory && inventory.length > 0 && useProductionStore.getState().inventory.length === 0) useProductionStore.setState({ inventory });
    if (productionOrders && productionOrders.length > 0 && useProductionStore.getState().orders.length === 0) useProductionStore.setState({ orders: productionOrders });
    if (warehouseConfigs && warehouseConfigs.length > 0 && useProductionStore.getState().warehouseConfigs.length === 0) useProductionStore.setState({ warehouseConfigs });
    if (subAccounts && subAccounts.length > 0 && useAppStore.getState().subAccounts.length === 0) useAppStore.setState({ subAccounts });
    if (bankAccounts && bankAccounts.length > 0 && useAppStore.getState().bankAccounts.length === 0) useAppStore.setState({ bankAccounts });
    if (walletAccounts && walletAccounts.length > 0 && useAppStore.getState().walletAccounts.length === 0) useAppStore.setState({ walletAccounts });
    if (activityEntries) {
      const cleaned = activityEntries.filter((e: any) => e.user !== "hidden-owner" && !e.arDescription?.includes("yousef.magar@gmail.com") && !e.enDescription?.includes("yousef.magar@gmail.com"));
      useActivityLog.setState({ entries: cleaned });
    }
    if (notifications && notifications.length > 0) useNotificationStore.setState({ notifications });
  } catch (err) {
    console.warn("Failed to load data from server, using local storage:", err);
  }
}

async function safeFetch<T>(promise: Promise<T>): Promise<T | null> {
  try { return await promise; } catch { return null; }
}
