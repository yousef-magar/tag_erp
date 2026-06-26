import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dexieStorage } from "@/lib/dexie-storage";

export interface ActivityEntry {
  id: string;
  module: string;
  action: string;
  description: string;
  arDescription: string;
  enDescription: string;
  user: string;
  timestamp: string;
  relatedId?: string;
  metadata?: Record<string, any>;
}

interface ActivityLogState {
  entries: ActivityEntry[];
  addEntry: (entry: Omit<ActivityEntry, "id" | "timestamp">) => void;
  clearAll: () => void;
  getByModule: (module: string) => ActivityEntry[];
  getByDateRange: (from: string, to: string) => ActivityEntry[];
  search: (query: string) => ActivityEntry[];
}

export const useActivityLog = create<ActivityLogState>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (entry) => set(s => ({
        entries: [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...entry }, ...s.entries].slice(0, 10000),
      })),
      clearAll: () => set({ entries: [] }),
      getByModule: (module) => get().entries.filter(e => e.module === module),
      getByDateRange: (from, to) => get().entries.filter(e => e.timestamp >= from && e.timestamp <= to + "T23:59:59.999Z"),
      search: (query) => {
        const q = query.toLowerCase();
        return get().entries.filter(e => e.arDescription.includes(q) || e.enDescription.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.module.includes(q) || e.user.includes(q));
      },
    }),
    { name: "ff-activity-log", storage: dexieStorage },
  ),
);

// ── Auto-logging helpers — call these from stores ──
export function logActivity(module: string, action: string, ar: string, en: string, relatedId?: string, metadata?: Record<string, any>) {
  const subId = localStorage.getItem("feedflow-logged-in-sub-account");
  let user = "مدير النظام";
  if (subId) {
    try { user = JSON.parse(subId).name; } catch { user = subId; }
  }
  const store = useActivityLog.getState();
  store.addEntry({ module, action, description: ar, arDescription: ar, enDescription: en, user, relatedId, metadata });
}
