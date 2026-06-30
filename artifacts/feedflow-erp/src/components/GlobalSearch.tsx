import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAppStore } from "@/hooks/use-app-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useSalesStore } from "@/hooks/use-sales-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { useFleetStore } from "@/hooks/use-fleet-store";
import { useProcurementStore } from "@/hooks/use-procurement-store";
import { useActivityLog } from "@/hooks/use-activity-log";
import {
  Search, Factory, ShoppingCart, Users, Truck, FileText, Package,
  UserCircle, TrendingUp, BarChart, Settings, Clock, X, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ShortcutHint from "@/components/ShortcutHint";

const MODULE_LABELS: Record<string, [string, string]> = {
  production: ["الإنتاج", "Production"],
  sales: ["المبيعات", "Sales"],
  customers: ["العملاء", "Customers"],
  fleet: ["الأسطول", "Fleet"],
  hr: ["الموارد البشرية", "HR"],
  procurement: ["المشتريات", "Procurement"],
  inventory: ["المخزون", "Inventory"],
  pricing: ["التسعير", "Pricing"],
  reports: ["التقارير", "Reports"],
  settings: ["الإعدادات", "Settings"],
  "activity-log": ["سجل النشاط", "Activity Log"],
  profit: ["الأرباح", "Profit"],
  invoices: ["الفواتير", "Invoices"],
};

const MODULE_BADGE_COLORS: Record<string, string> = {
  production: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  sales: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  customers: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  fleet: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  hr: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  procurement: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  inventory: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  pricing: "bg-red-500/10 text-red-600 dark:text-red-400",
  reports: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  settings: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  "activity-log": "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  profit: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  invoices: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

interface SearchResult {
  id: string;
  module: string;
  label: string;
  sublabel: string;
  path: string;
  icon: React.ElementType;
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  production: Factory, sales: ShoppingCart, customers: Users,
  fleet: Truck, hr: UserCircle, procurement: FileText,
  inventory: Package, pricing: TrendingUp, reports: BarChart,
  settings: Settings, "activity-log": Clock,
};

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, language } = useAppStore();
  const [, navigate] = useLocation();
  const { orders, inventory } = useProductionStore();
  const { invoices, customers } = useSalesStore();
  const { employees } = useHRStore();
  const { vehicles } = useFleetStore();
  const { suppliers } = useProcurementStore();
  const { entries } = useActivityLog();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    orders.forEach(o => {
      if (o.productName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
        items.push({ id: `order-${o.id}`, module: "production", label: o.productName, sublabel: `${o.status === "completed" ? "مكتمل" : o.status === "in-progress" ? "قيد التشغيل" : "معلق"} — ${o.id}`, path: "/production", icon: Factory });
    });
    inventory.forEach(i => {
      if (i.materialName.toLowerCase().includes(q))
        items.push({ id: `inv-${i.id}`, module: "inventory", label: i.materialName, sublabel: `الكمية: ${i.quantity} ${i.unit === "ton" ? "طن" : i.unit}`, path: "/inventory", icon: Package });
    });
    invoices.forEach(inv => {
      if (inv.customerName.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q))
        items.push({ id: `inv-${inv.id}`, module: "sales", label: inv.customerName, sublabel: `${inv.total.toLocaleString("ar-EG")} ج.م · ${inv.id}`, path: "/sales", icon: ShoppingCart });
    });
    customers.forEach(c => {
      if (c.name.toLowerCase().includes(q) || c.phone.includes(q))
        items.push({ id: `cust-${c.id}`, module: "customers", label: c.name, sublabel: `إجمالي المشتريات: ${c.totalPurchases.toLocaleString("ar-EG")} ج.م`, path: "/customers", icon: Users });
    });
    employees.forEach(e => {
      if (e.name.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q))
        items.push({ id: `emp-${e.id}`, module: "hr", label: e.name, sublabel: `${e.position} · ${e.department}`, path: "/hr", icon: UserCircle });
    });
    vehicles.forEach(v => {
      if (v.name.toLowerCase().includes(q) || v.plate.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q))
        items.push({ id: `veh-${v.id}`, module: "fleet", label: v.name, sublabel: `${v.driver} · ${v.plate}`, path: "/fleet", icon: Truck });
    });
    suppliers.forEach(s => {
      if (s.name.toLowerCase().includes(q) || s.material.toLowerCase().includes(q))
        items.push({ id: `sup-${s.id}`, module: "procurement", label: s.name, sublabel: s.material, path: "/procurement", icon: FileText });
    });
    entries.slice(0, 5).forEach(e => {
      if (e.arDescription.includes(q) || e.enDescription.toLowerCase().includes(q))
        items.push({ id: `log-${e.id}`, module: "activity-log", label: e.arDescription.slice(0, 50), sublabel: new Date(e.timestamp).toLocaleString("ar-EG"), path: "/activity-log", icon: Clock });
    });

    return items.slice(0, 15);
  }, [query, orders, inventory, invoices, customers, employees, vehicles, suppliers, entries]);

  const handleSelect = (result: SearchResult) => {
    onClose();
    navigate(result.path);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="w-full max-w-xl mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative border-b border-border">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t("ابحث في فواتير، عملاء، مخزون، موظفين...", "Search invoices, customers, inventory, employees...")}
                className="w-full h-12 bg-transparent text-sm px-12 outline-none placeholder:text-muted-foreground/40"
              />
              <div className="absolute left-12 top-1/2 -translate-y-1/2">
                <ShortcutHint keys={["Ctrl", "Shift", "G"]} />
              </div>
              <button onClick={onClose} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
              {results.length > 0 ? (
                <div className="space-y-0.5">
                  {results.map((r, i) => {
                    const Icon = r.icon;
                    const [labelAr, labelEn] = MODULE_LABELS[r.module] || [r.module, r.module];
                    const badgeColor = MODULE_BADGE_COLORS[r.module] || "bg-muted text-muted-foreground";
                    return (
                      <motion.button
                        key={r.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.015 }}
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-right group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1 text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{r.label}</span>
                            <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${badgeColor}`}>
                              {language === "ar" ? labelAr : labelEn}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.sublabel}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors shrink-0 rtl:rotate-180" />
                      </motion.button>
                    );
                  })}
                </div>
              ) : query.trim() ? (
                <div className="p-8 text-center">
                  <Search className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">{t("لا توجد نتائج", "No results found")}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{t("حاول بكلمة بحث مختلفة", "Try a different search term")}</p>
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground font-medium">
                      {t("ابدأ الكتابة للبحث في النظام", "Start typing to search")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { keys: "Ctrl+Shift+G", labelAr: "فتح البحث", labelEn: "Open search" },
                      { keys: "Ctrl+Shift+/", labelAr: "قائمة الاختصارات", labelEn: "Shortcuts list" },
                      { keys: "Ctrl+Alt+D", labelAr: "الرئيسية", labelEn: "Dashboard" },
                      { keys: "Ctrl+Alt+P", labelAr: "الإنتاج", labelEn: "Production" },
                      { keys: "Ctrl+Alt+S", labelAr: "المبيعات", labelEn: "Sales" },
                      { keys: "Ctrl+Alt+I", labelAr: "المخزون", labelEn: "Inventory" },
                      { keys: "Ctrl+Alt+F", labelAr: "الأسطول", labelEn: "Fleet" },
                      { keys: "Ctrl+Alt+H", labelAr: "الموارد البشرية", labelEn: "HR" },
                      { keys: "Ctrl+Alt+C", labelAr: "العملاء", labelEn: "Customers" },
                      { keys: "Ctrl+Alt+O", labelAr: "المشتريات", labelEn: "Procurement" },
                      { keys: "Ctrl+Alt+A", labelAr: "الحسابات", labelEn: "Accounting" },
                      { keys: "Ctrl+Alt+L", labelAr: "سجل النشاط", labelEn: "Activity Log" },
                      { keys: "Ctrl+Alt+G", labelAr: "الأرباح", labelEn: "Profit" },
                      { keys: "Ctrl+Alt+R", labelAr: "التقارير", labelEn: "Reports" },
                      { keys: "Ctrl+Alt+M", labelAr: "التسويق", labelEn: "Marketing" },
                      { keys: "Ctrl+Alt+K", labelAr: "الحسابات الفرعية", labelEn: "Sub Accounts" },
                      { keys: "Ctrl+Alt+E", labelAr: "الحضور", labelEn: "Attendance" },
                      { keys: "Ctrl+Alt+Y", labelAr: "الرواتب", labelEn: "Payroll" },
                      { keys: "Ctrl+Alt+T", labelAr: "الإعدادات", labelEn: "Settings" },
                      { keys: "Ctrl+Alt+N", labelAr: "إضافة جديد", labelEn: "New item" },
                      { keys: "Ctrl+Shift+S", labelAr: "حفظ", labelEn: "Save" },
                      { keys: "Ctrl+Shift+P", labelAr: "طباعة", labelEn: "Print" },
                      { keys: "Ctrl+Shift+R", labelAr: "تحديث", labelEn: "Refresh" },
                      { keys: "Ctrl+Shift+E", labelAr: "تصدير", labelEn: "Export" },
                      { keys: "Ctrl+Alt+Delete", labelAr: "حذف", labelEn: "Delete" },
                      { keys: "Esc", labelAr: "إغلاق", labelEn: "Close" },
                    ].map(shortcut => (
                      <div key={shortcut.keys} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-muted/30">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {language === "ar" ? shortcut.labelAr : shortcut.labelEn}
                        </span>
                        <kbd className="text-[9px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50">
                          {shortcut.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-[10px] text-muted-foreground/50 text-center">
                      {t("ابحث عن فواتير، عملاء، منتجات، موظفين، ناقلات، موردين، وأكثر", "Search invoices, customers, products, employees, vehicles, suppliers, and more")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
