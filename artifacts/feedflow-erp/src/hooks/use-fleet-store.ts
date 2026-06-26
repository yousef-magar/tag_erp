import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dexieStorage } from "@/lib/dexie-storage";
import { api } from "@/lib/api";
import { logActivity } from "./use-activity-log";

export interface VehicleExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

export interface FleetVehicle {
  id: string;
  name: string;
  plate: string;
  driver: string;
  driverPhone: string;
  type: "heavy" | "semi" | "quarter" | "light";
  maxCapacity: number;
  status: "available" | "loading" | "on-route" | "delivered";
  locationType: "at-factory" | "with-driver";
  address?: string;
  expenses?: VehicleExpense[];
}

export interface ShipmentStop {
  invoiceId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  region: string;
  governorate: string;
  village?: string;
  weightTons: number;
}

export interface Shipment {
  id: string;
  vehicleId: string;
  vehicleName: string;
  driverName: string;
  driverPhone: string;
  stops: ShipmentStop[];
  totalWeight: number;
  status: "pending" | "loaded" | "on-route" | "delivered";
  date: string;
  departureDate?: string;
  deliveredDate?: string;
  notes?: string;
}

const updateTreasury = (amount: number) => {
  try {
    const current = Number(JSON.parse(localStorage.getItem("feedflow-treasury") || "0"));
    const newBal = current - Number(amount);
    localStorage.setItem("feedflow-treasury", String(newBal));
    window.dispatchEvent(new CustomEvent("feedflow-treasury-update", { detail: newBal }));
  } catch {}
};

interface FleetState {
  vehicles: FleetVehicle[];
  shipments: Shipment[];
  addVehicle: (v: Omit<FleetVehicle, "id">) => Promise<FleetVehicle | void>;
  updateVehicle: (id: string, data: Partial<FleetVehicle>) => Promise<FleetVehicle | void>;
  deleteVehicle: (id: string) => Promise<void>;
  addVehicleExpense: (vehicleId: string, expense: Omit<VehicleExpense, "id">) => void;
  deleteVehicleExpense: (vehicleId: string, expenseId: string) => void;
  addShipment: (s: Shipment) => Promise<Shipment | void>;
  updateShipment: (id: string, data: Partial<Shipment>) => Promise<void>;
  deleteShipment: (id: string) => Promise<void>;
}

export const useFleetStore = create<FleetState>()(
  persist(
    (set) => ({
      vehicles: [],
      shipments: [],
      addVehicle: async (v) => {
        const vehicle: FleetVehicle = { ...v, id: `V${Date.now()}` };
        set(state => ({ vehicles: [...state.vehicles, vehicle] }));
        logActivity("fleet", "create", `إضافة مركبة جديدة: ${vehicle.name}`, `New vehicle: ${vehicle.name}`, vehicle.id);
        api.vehicles.create(vehicle).catch(() => {});
        return vehicle;
      },
      updateVehicle: async (id, data) => {
        set(state => ({ vehicles: state.vehicles.map(v => v.id === id ? { ...v, ...data } : v) }));
        logActivity("fleet", "update", `تحديث بيانات المركبة: ${data.name || ""}`, `Updated vehicle: ${data.name || ""}`, id);
        api.vehicles.update(id, data).catch(() => {});
      },
      deleteVehicle: async (id) => {
        set(state => ({ vehicles: state.vehicles.filter(v => v.id !== id) }));
        logActivity("fleet", "delete", `حذف المركبة`, `Deleted vehicle`, id);
        api.vehicles.delete(id).catch(() => {});
      },
      addVehicleExpense: (vehicleId, expense) => {
        const v = useFleetStore.getState().vehicles.find(v => v.id === vehicleId);
        set(state => ({
          vehicles: state.vehicles.map(v => {
            if (v.id !== vehicleId) return v;
            const newExpense = { ...expense, id: `exp-${Date.now()}` };
            updateTreasury(expense.amount);
            return { ...v, expenses: [...(v.expenses || []), newExpense] };
          }),
        }));
        logActivity("fleet", "create", `إضافة مصروف للمركبة: ${expense.description} - ${expense.amount} جنيه`, `Vehicle expense: ${expense.description} - ${expense.amount} EGP`, vehicleId);
      },
      deleteVehicleExpense: (vehicleId, expenseId) => {
        const v = useFleetStore.getState().vehicles.find(v => v.id === vehicleId);
        set(state => ({
          vehicles: state.vehicles.map(v => {
            if (v.id !== vehicleId) return v;
            return { ...v, expenses: (v.expenses || []).filter(e => e.id !== expenseId) };
          }),
        }));
        logActivity("fleet", "delete", `حذف مصروف من المركبة ${v?.name || ""}`, `Deleted expense from vehicle ${v?.name || ""}`, vehicleId);
      },
      addShipment: async (s) => {
        set(state => ({
          shipments: [...state.shipments, s],
          vehicles: state.vehicles.map(v => v.id === s.vehicleId ? { ...v, status: "loading" as const } : v),
        }));
        logActivity("fleet", "create", `إضافة شحنة جديدة للمركبة ${s.vehicleName}`, `New shipment for ${s.vehicleName}`, s.id);
        api.shipments.create(s).catch(() => {});
        return s;
      },
      updateShipment: async (id, data) => {
        set(state => {
          const s = state.shipments.find(sh => sh.id === id);
          if (data.status === "delivered" && s) {
            return {
              shipments: state.shipments.map(sh => sh.id === id ? { ...sh, ...data, deliveredDate: new Date().toISOString().split("T")[0] } : sh),
              vehicles: state.vehicles.map(v => v.id === s.vehicleId ? { ...v, status: "available" as const, locationType: "at-factory" as const } : v),
            };
          }
          if (data.status === "on-route" && s) {
            return {
              shipments: state.shipments.map(sh => sh.id === id ? { ...sh, ...data, departureDate: new Date().toISOString().split("T")[0] } : sh),
              vehicles: state.vehicles.map(v => v.id === s.vehicleId ? { ...v, status: "on-route" as const, locationType: "with-driver" as const } : v),
            };
          }
          return {
            shipments: state.shipments.map(sh => sh.id === id ? { ...sh, ...data } : sh),
          };
        });
        if (data.status === "delivered") {
          logActivity("fleet", "update", `تسليم الشحنة ${id}`, `Shipment delivered ${id}`, id);
        } else if (data.status === "on-route") {
          logActivity("fleet", "update", `انطلاق الشحنة ${id}`, `Shipment departed ${id}`, id);
        }
        api.shipments.update(id, data).catch(() => {});
      },
      deleteShipment: async (id) => {
        set(state => ({ shipments: state.shipments.filter(sh => sh.id !== id) }));
        api.shipments.delete(id).catch(() => {});
      },
    }),
    { name: "ff-fleet", storage: dexieStorage }
  )
);
