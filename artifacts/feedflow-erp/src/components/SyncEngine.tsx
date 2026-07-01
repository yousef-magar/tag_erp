import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/hooks/use-app-store";
import { useSalesStore } from "@/hooks/use-sales-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { useFleetStore } from "@/hooks/use-fleet-store";
import { useProcurementStore } from "@/hooks/use-procurement-store";
import { usePricingStore } from "@/hooks/use-pricing-store";
import { useNotificationStore } from "@/hooks/use-notification-store";

type SyncTask = {
  fetch: () => Promise<any>;
  apply: (data: any) => void;
};

const SYNC_TASKS: SyncTask[] = [
  // Production
  { fetch: () => api.inventory.list(), apply: (d) => { if (Array.isArray(d) && d.length) useProductionStore.setState({ inventory: d }) } },
  { fetch: () => api.productionOrders.list(), apply: (d) => { if (Array.isArray(d) && d.length) useProductionStore.setState({ orders: d }) } },
  { fetch: () => api.warehouseConfigs.list(), apply: (d) => { if (Array.isArray(d) && d.length) useProductionStore.setState({ warehouseConfigs: d }) } },
  // Sales
  { fetch: () => api.customers.list(), apply: (d) => { if (Array.isArray(d) && d.length) useSalesStore.setState({ customers: d }) } },
  { fetch: () => api.invoices.list(), apply: (d) => { if (Array.isArray(d) && d.length) useSalesStore.setState({ invoices: d }) } },
  { fetch: () => api.returns.list(), apply: (d) => { if (Array.isArray(d) && d.length) useSalesStore.setState({ returns: d }) } },
  { fetch: () => api.payments.list(), apply: (d) => { if (Array.isArray(d) && d.length) useSalesStore.setState({ payments: d }) } },
  // HR
  { fetch: () => api.employees.list(), apply: (d) => { if (Array.isArray(d) && d.length) useHRStore.setState({ employees: d }) } },
  { fetch: () => api.shifts.list(), apply: (d) => { if (Array.isArray(d) && d.length) useHRStore.setState({ shifts: d }) } },
  { fetch: () => api.payroll.list(), apply: (d) => { if (Array.isArray(d) && d.length) useHRStore.setState({ payrollTransactions: d }) } },
  // Fleet
  { fetch: () => api.vehicles.list(), apply: (d) => { if (Array.isArray(d) && d.length) useFleetStore.setState({ vehicles: d }) } },
  { fetch: () => api.shipments.list(), apply: (d) => { if (Array.isArray(d) && d.length) useFleetStore.setState({ shipments: d }) } },
  // Procurement
  { fetch: () => api.suppliers.list(), apply: (d) => { if (Array.isArray(d) && d.length) useProcurementStore.setState({ suppliers: d }) } },
  { fetch: () => api.purchaseOrders.list(), apply: (d) => { if (Array.isArray(d) && d.length) useProcurementStore.setState({ orders: d }) } },
  { fetch: () => api.purchaseReturns.list(), apply: (d) => { if (Array.isArray(d) && d.length) useProcurementStore.setState({ returns: d }) } },
  { fetch: () => api.supplierPayments.list(), apply: (d) => { if (Array.isArray(d) && d.length) useProcurementStore.setState({ payments: d }) } },
  // Pricing
  { fetch: () => api.productPrices.list(), apply: (d) => { if (Array.isArray(d) && d.length) usePricingStore.setState({ productPrices: d }) } },
  { fetch: () => api.pricingAlerts.list(), apply: (d) => { if (Array.isArray(d) && d.length) usePricingStore.setState({ pricingAlerts: d }) } },
  // Accounting
  { fetch: () => api.bankAccounts.list(), apply: (d) => { if (Array.isArray(d) && d.length) useAppStore.setState({ bankAccounts: d }) } },
  { fetch: () => api.walletAccounts.list(), apply: (d) => { if (Array.isArray(d) && d.length) useAppStore.setState({ walletAccounts: d }) } },
  // Notifications
  { fetch: () => api.notifications.list(), apply: (d) => { if (Array.isArray(d) && d.length) useNotificationStore.setState({ notifications: d }) } },
];

const SYNC_INTERVAL = 8000;

export function SyncEngine() {
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const run = async () => {
      setSyncing(true);
      await Promise.allSettled(SYNC_TASKS.map(t =>
        t.fetch().then(d => { if (d) t.apply(d); }).catch(() => {})
      ));
      setLastSync(new Date());
      setSyncing(false);
    };

    run();
    timerRef.current = setInterval(run, SYNC_INTERVAL);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <div className={`fixed bottom-4 left-4 z-50 flex items-center gap-1.5 text-[10px] transition-opacity ${syncing ? "opacity-100" : "opacity-40 hover:opacity-100"}`}>
      <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
      <span className="text-muted-foreground">
        {syncing ? "..." : lastSync ? lastSync.toLocaleTimeString("ar-EG") : ""}
      </span>
    </div>
  );
}
