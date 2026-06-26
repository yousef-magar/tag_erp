import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dexieStorage } from "@/lib/dexie-storage";
import { api } from "@/lib/api";
import { logActivity } from "./use-activity-log";

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  code: string;
  address: string;
  material: string;
  outstandingDebt: number;
  totalPurchases: number;
  lastPurchase: string;
  status: "active" | "inactive";
}

export interface PurchaseOrderItem {
  material: string;
  qty: number;
  unit: "ton" | "kg" | "bag";
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  dueDate?: string;
  status: "pending" | "approved" | "delivered" | "paid" | "overdue";
  items: PurchaseOrderItem[];
  total: number;
  paidAmount: number;
  payMethod?: string;
  payBank?: string;
  notes?: string;
}

export interface PurchaseReturnItem {
  material: string;
  qty: number;
  unit: "ton" | "kg" | "bag";
  unitPrice: number;
  total: number;
}

export interface PurchaseReturn {
  id: string;
  poId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseReturnItem[];
  total: number;
  reason: string;
}

export interface SupplierPaymentAllocation {
  poId: string;
  amount: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  method: "cash" | "bank_transfer" | "vodafone_cash" | "instapay";
  bankId?: string;
  allocations: SupplierPaymentAllocation[];
  notes?: string;
}

interface ProcState {
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  returns: PurchaseReturn[];
  payments: SupplierPayment[];
  addSupplier: (s: Omit<Supplier, "id" | "totalPurchases" | "lastPurchase">) => Promise<Supplier | null>;
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<Supplier | null>;
  deleteSupplier: (id: string) => Promise<void>;
  addOrder: (o: PurchaseOrder) => Promise<PurchaseOrder | null>;
  updateOrder: (id: string, data: Partial<PurchaseOrder>) => Promise<PurchaseOrder | null>;
  deleteOrder: (id: string) => Promise<void>;
  addReturn: (r: PurchaseReturn) => Promise<PurchaseReturn | null>;
  addPayment: (pmt: SupplierPayment) => Promise<SupplierPayment | null>;
  recalcDebt: (supplierId: string) => void;
  nextOrderNum: () => number;
  nextReturnNum: () => number;
}

export const useProcurementStore = create<ProcState>()(
  persist(
    (set, get) => ({
      suppliers: [],
      orders: [],
      returns: [],
      payments: [],
      addSupplier: async (s) => {
        const full = { ...s, id: `SUP-${Date.now()}`, totalPurchases: 0, lastPurchase: "" };
        set(state => ({ suppliers: [...state.suppliers, full] }));
        logActivity("procurement", "create", `إضافة مورد: ${full.name}`, `Add supplier: ${full.name}`, full.id);
        api.suppliers.create(full).catch(() => {});
        return full;
      },
      updateSupplier: async (id, data) => {
        const existing = get().suppliers.find(s => s.id === id);
        const merged = existing ? { ...existing, ...data } : ({ ...data, id } as Supplier);
        set(state => ({ suppliers: state.suppliers.map(s => s.id === id ? merged : s) }));
        logActivity("procurement", "update", `تحديث بيانات المورد: ${id}`, `Update supplier: ${id}`, id);
        api.suppliers.update(id, data).catch(() => {});
        return merged;
      },
      deleteSupplier: async (id) => {
        set(state => ({ suppliers: state.suppliers.filter(s => s.id !== id) }));
        logActivity("procurement", "delete", `حذف المورد: ${id}`, `Delete supplier: ${id}`, id);
        api.suppliers.delete(id).catch(() => {});
      },
      addOrder: async (o) => {
        set(state => {
          const now = new Date().toISOString().split("T")[0];
          return {
            orders: [...state.orders, o],
            suppliers: state.suppliers.map(s => s.id === o.supplierId ? {
              ...s,
              totalPurchases: (s.totalPurchases || 0) + Number(o.total || 0),
              lastPurchase: now,
              outstandingDebt: (s.outstandingDebt || 0) + (Number(o.total || 0) - Number(o.paidAmount || 0)),
            } : s),
          };
        });
        logActivity("procurement", "create", `إنشاء أمر شراء: ${o.id} - ${o.supplierName} - ${o.total} جنيه`, `New PO: ${o.id} - ${o.supplierName} - ${o.total} EGP`, o.id);
        api.purchaseOrders.create(o).catch(() => {});
        return o;
      },
      updateOrder: async (id, data) => {
        const existing = get().orders.find(o => o.id === id);
        const merged = existing ? { ...existing, ...data } : ({ ...data, id } as PurchaseOrder);
        set(state => ({ orders: state.orders.map(o => o.id === id ? merged : o) }));
        logActivity("procurement", "update", `تحديث أمر الشراء: ${id}`, `Update PO: ${id}`, id);
        api.purchaseOrders.update(id, data).catch(() => {});
        return merged;
      },
      deleteOrder: async (id) => {
        set(state => ({ orders: state.orders.filter(o => o.id !== id) }));
        logActivity("procurement", "delete", `حذف أمر الشراء: ${id}`, `Delete PO: ${id}`, id);
        api.purchaseOrders.delete(id).catch(() => {});
      },
      addReturn: async (r) => {
        set(state => ({
          returns: [...state.returns, r],
          orders: state.orders.map(o => o.id === r.poId ? { ...o, total: (o.total || 0) - (r.total || 0) } : o),
        }));
        logActivity("procurement", "create", `إضافة مرتجع مشتريات: ${r.id} - ${r.total} جنيه`, `New purchase return: ${r.id} - ${r.total} EGP`, r.id);
        api.purchaseReturns.create(r).catch(() => {});
        return r;
      },
      addPayment: async (pmt) => {
        set(state => {
          let updatedOrders = [...state.orders];
          for (const alloc of pmt.allocations) {
            updatedOrders = updatedOrders.map(o =>
              o.id === alloc.poId
                ? { ...o, paidAmount: (o.paidAmount || 0) + alloc.amount, status: ((o.paidAmount || 0) + alloc.amount >= o.total ? "paid" : o.status) as any }
                : o
            );
          }
          const paidTotal = pmt.allocations.reduce((s, a) => s + a.amount, 0);
          return {
            payments: [...state.payments, pmt],
            orders: updatedOrders,
            suppliers: state.suppliers.map(s =>
              s.id === pmt.supplierId
                ? { ...s, outstandingDebt: Math.max(0, (s.outstandingDebt || 0) - paidTotal) }
                : s
            ),
          };
        });
        logActivity("procurement", "create", `تسجيل دفعة مورد: ${pmt.amount} جنيه لـ ${pmt.supplierName}`, `Supplier payment: ${pmt.amount} EGP to ${pmt.supplierName}`, pmt.id);
        api.supplierPayments.create(pmt).catch(() => {});
        return pmt;
      },
      recalcDebt: (supplierId) => set(state => {
        const total = state.orders
          .filter(o => o.supplierId === supplierId)
          .reduce((s, o) => s + (o.total - (o.paidAmount || 0)), 0);
        return {
          suppliers: state.suppliers.map(s => s.id === supplierId ? { ...s, outstandingDebt: total } : s),
        };
      }),
      nextOrderNum: () => {
        const orders = get().orders;
        const max = orders.reduce((m, o) => Math.max(m, parseInt(o.id.replace("PO-", "")) || 0), 0);
        return max + 1;
      },
      nextReturnNum: () => {
        const returns = get().returns;
        const max = returns.reduce((m, r) => Math.max(m, parseInt(r.id.replace("PR-", "")) || 0), 0);
        return max + 1;
      },
    }),
    { name: "ff-procurement", storage: dexieStorage }
  )
);
