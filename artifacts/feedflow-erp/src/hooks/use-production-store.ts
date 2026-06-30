import { create } from "zustand";
import { dexieStorage } from "@/lib/dexie-storage";
import { api } from "@/lib/api";
import { logActivity } from "./use-activity-log";


/* ─── Shared Types ─── */
export type FormulaIngredient = { material: string; pct: number };
export type BagEntry          = { id: string; weightKg: number; count: number };
export type WorkSession       = { date: string; startedAt: string; endedAt: string | null; durationMins: number | null };
export type OrderStatus       = "pending" | "in-progress" | "paused" | "completed";
export type ProductionOrder   = {
  id: string; productId: string; productName: string;
  targetTons: number; producedTons: number; status: OrderStatus;
  date: string; plannedStart: string; plannedEnd: string;
  sessions: WorkSession[]; bags: BagEntry[]; warehouseId: string;
};
export type InventoryItem = {
  id: string; materialName: string; quantity: number; initialQuantity: number; consumedQuantity: number;
  unit: string;
  warehouseId: string; batchNumber: string; productionDate: string;
  expiryDate: string; alertLevel: "normal" | "warning" | "critical";
  type: "raw" | "finished";
  source?: string; // PO ID or production order ID that created this item
};

/* ─── Warehouse Configuration (with alert thresholds) ─── */
export type WarehouseConfig = {
  id: string;
  name: string;
  normalThreshold: number;  // remaining % >= this → normal (آمن)
  warningThreshold: number; // remaining % <  this → critical (حرج)
};

export const DEFAULT_WAREHOUSES: WarehouseConfig[] = [];

/* ─── Substitution Types ─── */
export type FormulaSubstitution = {
  originalMaterial: string;
  replacedWith: string;
  reason: "out_of_stock" | "insufficient_stock";
};

export type ResolvedIngredient = FormulaIngredient & {
  substitution?: FormulaSubstitution;
};

/* ─── Defaults ─── */
const nowDate = () => new Date().toISOString().split("T")[0];

export const DEFAULT_FORMULAS: Record<string, FormulaIngredient[]> = {};

const DEFAULT_INVENTORY: InventoryItem[] = [];

const DEFAULT_ORDERS: ProductionOrder[] = [];

/* ─── Helpers ─── */

/** Fuzzy-match a formula material name to an inventory item (word-subset check) */
export function findInventoryMatch(materialName: string, inventory: InventoryItem[]): InventoryItem | undefined {
  const words = materialName.toLowerCase().trim().split(/\s+/).filter(w => w.length > 1);
  return inventory.find(item => {
    const lower = item.materialName.toLowerCase();
    return words.length > 0 && words.every(w => lower.includes(w));
  });
}

/**
 * Find the best substitute for a depleted ingredient.
 * Matches by the first significant word (e.g. "ذرة", "صويا", "نخالة")
 * and picks the inventory item with the most stock that isn't the current match.
 */
export function findBestSubstitute(
  material: string,
  inventory: InventoryItem[],
  currentMatchId?: string,
): InventoryItem | undefined {
  const words = material.trim().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return undefined;

  const mainWord = words[0]; // key category word, e.g. "ذرة", "صويا"

  const candidates = inventory.filter(item => {
    if (item.type !== "raw") return false;
    if (currentMatchId && item.id === currentMatchId) return false;
    if (item.materialName === material) return false;
    const lower = item.materialName.toLowerCase();
    return lower.includes(mainWord);
  });

  if (!candidates.length) return undefined;

  // Pick the candidate with most available tonnage
  return candidates.sort((a, b) => {
    const aTons = a.unit === "kg" ? a.quantity / 1000 : a.quantity;
    const bTons = b.unit === "kg" ? b.quantity / 1000 : b.quantity;
    return bTons - aTons;
  })[0];
}

/**
 * Resolve formula ingredients against real inventory.
 * If an ingredient has insufficient stock, automatically substitutes with
 * the best available alternative of the same category.
 * Returns ResolvedIngredient[] — same shape as FormulaIngredient[] but
 * with an optional `substitution` field when a swap occurred.
 */
export function resolveFormulaIngredients(
  formula: FormulaIngredient[],
  inventory: InventoryItem[],
  neededTons: number,
): ResolvedIngredient[] {
  const rawInventory = inventory.filter(i => i.type === "raw");

  return formula.map(ing => {
    const needed = (neededTons * ing.pct) / 100;
    const match  = findInventoryMatch(ing.material, rawInventory);
    const avail  = match
      ? match.unit === "kg" ? match.quantity / 1000 : match.quantity
      : 0;

    if (avail >= needed) return ing; // enough stock — no substitution

    const substitute = findBestSubstitute(ing.material, rawInventory, match?.id);
    if (!substitute) return ing; // no suitable substitute found

    const substAvail = substitute.unit === "kg"
      ? substitute.quantity / 1000
      : substitute.quantity;
    if (substAvail < needed) return ing; // substitute also insufficient

    return {
      pct: ing.pct,
      material: substitute.materialName,
      substitution: {
        originalMaterial: ing.material,
        replacedWith: substitute.materialName,
        reason: avail <= 0 ? "out_of_stock" : "insufficient_stock",
      },
    } as ResolvedIngredient;
  });
}

function calcAlertLevel(qty: number, initialQty: number, normalThreshold = 50, warningThreshold = 20): "normal"|"warning"|"critical" {
  if (initialQty <= 0) return "critical";
  const pct = (qty / initialQty) * 100;
  if (pct < warningThreshold) return "critical";
  if (pct < normalThreshold) return "warning";
  return "normal";
}

/* ─── Store ─── */
interface ProductionState {
  formulas:     Record<string, FormulaIngredient[]>;
  updateFormula:(productId:string, ingredients:FormulaIngredient[])=>void;
  deleteFormula:(productId:string)=>void;

  orders:    ProductionOrder[];
  addOrder:  (o:ProductionOrder)=>Promise<ProductionOrder|undefined>;
  updateOrder:(id:string, u:Partial<ProductionOrder>)=>Promise<ProductionOrder|undefined>;
  deleteOrder:(id:string)=>Promise<void>;

  inventory:          InventoryItem[];
  addInventoryItem:   (item:InventoryItem)=>Promise<InventoryItem|undefined>;
  updateInventoryItem:(id:string, updates:Partial<InventoryItem>)=>Promise<InventoryItem|undefined>;
  deleteInventoryItem:(id:string)=>Promise<void>;
  deleteInventoryItemsBySource:(source:string)=>Promise<void>;
  setInventory:       (items:InventoryItem[])=>void;
  consumeRawMaterials:   (productId:string, producedTons:number, resolvedIngredients?:ResolvedIngredient[], warehouseId?:string)=>void;
  consumeFinishedProduct:(productId:string, soldTons:number)=>void;
  addFinishedProduct:    (productId:string, productName:string, producedTons:number, warehouseId?:string)=>void;

  warehouseConfigs:      WarehouseConfig[];
  updateWarehouseConfig: (id:string, cfg:Partial<WarehouseConfig>)=>Promise<void>;
  addWarehouseConfig:    (cfg:WarehouseConfig)=>Promise<WarehouseConfig|null|undefined>;
  deleteWarehouseConfig: (id:string)=>void;
  setWarehouseConfigs:   (cfgs:WarehouseConfig[])=>void;
}

function load<T>(key:string, def:T): T {
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s) as T; } catch {}
  return def;
}
function save<T>(key:string, val:T){
  localStorage.setItem(key, JSON.stringify(val));
  dexieStorage.setItem(key, { state: val }).catch(() => {});
}

export const useProductionStore = create<ProductionState>((set, get) => ({

  /* ── Formulas ── */
  formulas: load("ff-formulas", DEFAULT_FORMULAS),
  updateFormula: (productId, ingredients) => set(state => {
    const updated = { ...state.formulas, [productId]: ingredients };
    save("ff-formulas", updated);
    return { formulas: updated };
  }),
  deleteFormula: (productId) => set(state => {
    const { [productId]: _, ...rest } = state.formulas;
    save("ff-formulas", rest);
    return { formulas: rest };
  }),

  /* ── Orders ── */
  orders: load("ff-orders", DEFAULT_ORDERS),
  addOrder: async (o) => {
    set(state => {
      const updated = [o, ...state.orders];
      save("ff-orders", updated);
      return { orders: updated };
    });
    logActivity("production", "create", `إنشاء أمر إنتاج: ${o.productName}`, `New production order: ${o.productName}`, o.id);
    api.productionOrders.create(o).catch(() => {});
    return o;
  },
  updateOrder: async (id, u) => {
    const existing = get().orders.find(o => o.id === id);
    const merged = existing ? { ...existing, ...u } : ({ ...u, id } as ProductionOrder);
    set(state => {
      const list = state.orders.map(o => o.id === id ? merged : o);
      save("ff-orders", list);
      return { orders: list };
    });
    logActivity("production", "update", `تحديث أمر الإنتاج: ${id}`, `Update production order: ${id}`, id);
    api.productionOrders.update(id, u).catch(() => {});
    return merged;
  },
  deleteOrder: async (id) => {
    set(state => {
      const updated = state.orders.filter(o => o.id !== id);
      save("ff-orders", updated);
      return { orders: updated };
    });
    logActivity("production", "delete", `حذف أمر الإنتاج: ${id}`, `Delete production order: ${id}`, id);
    api.productionOrders.delete(id).catch(() => {});
  },

  /* ── Warehouse Configs ── */
  warehouseConfigs: load("ff-warehouses", DEFAULT_WAREHOUSES),
  updateWarehouseConfig: async (id, cfg) => {
    set(state => {
      const list = state.warehouseConfigs.map(w => w.id === id ? { ...w, ...cfg } : w);
      save("ff-warehouses", list);
      return { warehouseConfigs: list };
    });
    logActivity("settings", "update", `تحديث المخزن: ${id}`, `Update warehouse: ${id}`, id);
    api.warehouseConfigs.update(id, cfg).catch(() => {});
  },
  addWarehouseConfig: async (cfg) => {
    const saved = { ...cfg };
    set(state => {
      const list = [...state.warehouseConfigs, saved];
      save("ff-warehouses", list);
      return { warehouseConfigs: list };
    });
    logActivity("settings", "create", `إضافة مخزن: ${saved.name}`, `Add warehouse: ${saved.name}`);
    api.warehouseConfigs.create(cfg).catch(() => {});
    return saved;
  },
  setWarehouseConfigs: (cfgs) => { save("ff-warehouses", cfgs); set({ warehouseConfigs: cfgs }); },
  deleteWarehouseConfig: (id) => {
    set(state => {
      const list = state.warehouseConfigs.filter(w => w.id !== id);
      save("ff-warehouses", list);
      return { warehouseConfigs: list };
    });
    logActivity("settings", "delete", `حذف المخزن`, `Delete warehouse`, id);
  },

  /* ── Inventory ── */
  inventory: load("ff-inventory", DEFAULT_INVENTORY),
  addInventoryItem: async (item) => {
    const savedItem = { ...item, id: item.id || `INV-${Date.now()}` };
    set(state => {
      const updated = [savedItem, ...state.inventory];
      save("ff-inventory", updated);
      return { inventory: updated };
    });
    // Sync to pricing store so the item appears in Pricing & Cost
    const { usePricingStore: ps } = await import("./use-pricing-store");
    ps.getState().ensureInventoryPrices([{
      id: savedItem.id,
      materialName: savedItem.materialName,
      type: savedItem.type,
      unit: savedItem.unit,
    }]);
    logActivity("inventory", "create", `إضافة صنف مخزون: ${savedItem.materialName}`, `Add inventory item: ${savedItem.materialName}`, savedItem.id);
    api.inventory.create(item).catch(() => {});
    return savedItem;
  },
  updateInventoryItem: async (id, updates) => {
    const existing = get().inventory.find(i => i.id === id);
    const merged = existing ? { ...existing, ...updates } : ({ ...updates, id } as InventoryItem);
    set(state => {
      const list = state.inventory.map(i => i.id === id ? merged : i);
      save("ff-inventory", list);
      return { inventory: list };
    });
    logActivity("inventory", "update", `تحديث صنف المخزون: ${id}`, `Update inventory item: ${id}`, id);
    api.inventory.update(Number(id), updates).catch(() => {});
    return merged;
  },
  deleteInventoryItem: async (id) => {
    set(state => {
      const updated = state.inventory.filter(i => i.id !== id);
      save("ff-inventory", updated);
      return { inventory: updated };
    });
    logActivity("inventory", "delete", `حذف صنف المخزون`, `Delete inventory item`, id);
    api.inventory.delete(Number(id)).catch(() => {});
  },
  deleteInventoryItemsBySource: async (source) => {
    set(state => {
      const updated = state.inventory.filter(i => i.source !== source);
      save("ff-inventory", updated);
      return { inventory: updated };
    });
    logActivity("inventory", "delete", `حذف أصناف المخزون حسب المصدر: ${source}`, `Delete inventory items by source: ${source}`, source);
  },
  setInventory: (items) => { save("ff-inventory", items); set({ inventory: items }); },

  /** Deduct raw materials consumed by a completed production order.
   *  Accepts optional resolvedIngredients to honour auto-substitutions. */
  consumeRawMaterials: (productId, producedTons, resolvedIngredients, warehouseId) => {
    const { formulas, inventory, warehouseConfigs } = get();
    const formula = resolvedIngredients ?? (formulas[productId] || []);
    const updated = [...inventory];
    const candidates = warehouseId ? updated.filter(i => i.type === "raw" && i.warehouseId === warehouseId) : updated.filter(i => i.type === "raw");
    for (const ing of formula) {
      const neededTons = (producedTons * ing.pct) / 100;
      const match = findInventoryMatch(ing.material, candidates);
      if (!match) continue;
      const idx = updated.findIndex(i => i.id === match.id);
      if (idx === -1) continue;
      const consumed = match.unit === "kg" ? neededTons * 1000 : neededTons;
      const newQty   = Math.max(0, +(match.quantity - consumed).toFixed(2));
      const newConsumed = +(match.consumedQuantity + consumed).toFixed(2);
      const whCfg = warehouseConfigs.find(w => w.id === match.warehouseId);
      updated[idx] = { ...match, quantity: newQty, consumedQuantity: newConsumed, alertLevel: calcAlertLevel(newQty, match.initialQuantity, whCfg?.normalThreshold, whCfg?.warningThreshold) };
    }
    save("ff-inventory", updated);
    set({ inventory: updated });
  },

  /** Deduct finished products consumed by a sales invoice */
  consumeFinishedProduct: (productId, soldTons) => {
    const { inventory, warehouseConfigs } = get();
    const updated = [...inventory];
    const match = updated.find(i => i.type === "finished" && i.id === productId);
    if (!match) return;
    const idx = updated.findIndex(i => i.id === match.id);
    if (idx === -1) return;
    const consumed = match.unit === "kg" ? soldTons * 1000 : soldTons;
    const newQty   = Math.max(0, +(match.quantity - consumed).toFixed(2));
    const newConsumed = +(match.consumedQuantity + consumed).toFixed(2);
    const whCfg = warehouseConfigs.find(w => w.id === match.warehouseId);
    updated[idx] = { ...match, quantity: newQty, consumedQuantity: newConsumed, alertLevel: calcAlertLevel(newQty, match.initialQuantity, whCfg?.normalThreshold, whCfg?.warningThreshold) };
    save("ff-inventory", updated);
    set({ inventory: updated });
  },

  /** Add completed production as a finished-product inventory entry */
  addFinishedProduct: (productId, productName, producedTons, warehouseId) => {
    const item: InventoryItem = {
      id: `FP-${Date.now()}`,
      materialName: productName,
      quantity: producedTons,
      initialQuantity: producedTons,
      consumedQuantity: 0,
      unit: "ton",
      warehouseId: warehouseId || "W1",
      batchNumber: `PRD-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`,
      productionDate: nowDate(),
      expiryDate: new Date(Date.now() + 180*24*60*60*1000).toISOString().split("T")[0],
      alertLevel: "normal",
      type: "finished",
    };
    set(state => {
      const updated = [item, ...state.inventory];
      save("ff-inventory", updated);
      return { inventory: updated };
    });
  },
}));
