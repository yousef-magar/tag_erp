import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";

export interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  descriptionAr: string;
  descriptionEn: string;
  action?: () => void;
}

const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // ── Navigation (Ctrl+Alt) ──
  { key: "d", ctrl: true, alt: true, descriptionAr: "الرئيسية", descriptionEn: "Dashboard" },
  { key: "p", ctrl: true, alt: true, descriptionAr: "الإنتاج", descriptionEn: "Production" },
  { key: "s", ctrl: true, alt: true, descriptionAr: "المبيعات", descriptionEn: "Sales" },
  { key: "i", ctrl: true, alt: true, descriptionAr: "المخزون", descriptionEn: "Inventory" },
  { key: "f", ctrl: true, alt: true, descriptionAr: "الأسطول", descriptionEn: "Fleet" },
  { key: "h", ctrl: true, alt: true, descriptionAr: "الموارد البشرية", descriptionEn: "HR" },
  { key: "r", ctrl: true, alt: true, descriptionAr: "التقارير", descriptionEn: "Reports" },
  { key: "l", ctrl: true, alt: true, descriptionAr: "سجل النشاط", descriptionEn: "Activity Log" },
  { key: "g", ctrl: true, alt: true, descriptionAr: "الأرباح", descriptionEn: "Profit" },
  { key: "t", ctrl: true, alt: true, descriptionAr: "الإعدادات", descriptionEn: "Settings" },
  { key: "c", ctrl: true, alt: true, descriptionAr: "العملاء", descriptionEn: "Customers" },
  { key: "o", ctrl: true, alt: true, descriptionAr: "المشتريات", descriptionEn: "Procurement" },
  { key: "a", ctrl: true, alt: true, descriptionAr: "الحسابات", descriptionEn: "Accounting" },
  { key: "m", ctrl: true, alt: true, descriptionAr: "التسويق", descriptionEn: "Marketing" },
  { key: "k", ctrl: true, alt: true, descriptionAr: "الحسابات الفرعية", descriptionEn: "Sub Accounts" },
  { key: "e", ctrl: true, alt: true, descriptionAr: "الحضور والانصراف", descriptionEn: "Attendance" },
  { key: "y", ctrl: true, alt: true, descriptionAr: "الرواتب", descriptionEn: "Payroll" },
  { key: "u", ctrl: true, alt: true, descriptionAr: "الفواتير", descriptionEn: "Invoices" },
  // ── Global ──
  { key: "g", ctrl: true, shift: true, descriptionAr: "البحث العام", descriptionEn: "Global Search" },
  { key: "/", ctrl: true, shift: true, descriptionAr: "اختصارات لوحة المفاتيح", descriptionEn: "Keyboard Shortcuts" },
  { key: "n", ctrl: true, alt: true, descriptionAr: "إضافة جديد", descriptionEn: "New Item" },
  { key: "Escape", descriptionAr: "إغلاق", descriptionEn: "Close" },
  { key: "p", ctrl: true, shift: true, descriptionAr: "طباعة", descriptionEn: "Print" },
  { key: "s", ctrl: true, shift: true, descriptionAr: "حفظ", descriptionEn: "Save" },
  { key: "Delete", ctrl: true, alt: true, descriptionAr: "حذف", descriptionEn: "Delete" },
  { key: "r", ctrl: true, shift: true, descriptionAr: "تحديث", descriptionEn: "Refresh" },
  { key: "e", ctrl: true, shift: true, descriptionAr: "تصدير", descriptionEn: "Export" },
];

export function useKeyboardShortcuts(
  globalSearchOpen: boolean,
  setGlobalSearchOpen: (v: boolean) => void,
  onNewItem?: () => void,
  onSave?: () => void,
  onDelete?: () => void,
  onRefresh?: () => void,
  onExport?: () => void,
) {
  const [, navigate] = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  const toggleHelp = useCallback(() => setHelpOpen(v => !v), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Escape
      if (e.key === "Escape") {
        if (helpOpen) { closeHelp(); e.preventDefault(); e.stopPropagation(); return; }
        if (globalSearchOpen) { setGlobalSearchOpen(false); e.preventDefault(); e.stopPropagation(); return; }
        return;
      }

      // Ctrl+Shift+K or Ctrl+Shift+G = global search (safe - no browser conflict)
      if (e.ctrlKey && e.shiftKey && (e.code === "KeyK" || e.code === "KeyG")) {
        e.preventDefault();
        e.stopPropagation();
        setGlobalSearchOpen(!globalSearchOpen);
        return;
      }

      // Ctrl+Shift+/ = shortcuts help
      if (e.ctrlKey && e.shiftKey && e.code === "Slash") {
        e.preventDefault();
        e.stopPropagation();
        toggleHelp();
        return;
      }
      // ?/؟ = shortcuts help (not in input)
      if ((e.key === "?" || e.key === "؟") && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        toggleHelp();
        return;
      }

      // Ctrl+Shift+P = print
      if (e.ctrlKey && e.shiftKey && e.code === "KeyP" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        window.print();
        return;
      }

      // Ctrl+Shift+S = save
      if (e.ctrlKey && e.shiftKey && e.code === "KeyS" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        onSave?.();
        return;
      }

      // Ctrl+Shift+R = refresh
      if (e.ctrlKey && e.shiftKey && e.code === "KeyR" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        onRefresh?.();
        return;
      }

      // Ctrl+Shift+E = export
      if (e.ctrlKey && e.shiftKey && e.code === "KeyE" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        onExport?.();
        return;
      }

      // Ctrl+Alt navigation (uses e.code for keyboard-layout independence)
      if (e.ctrlKey && e.altKey && !e.shiftKey) {
        const map: Record<string, string> = {
          KeyD: "/", KeyP: "/production", KeyS: "/sales", KeyI: "/inventory",
          KeyF: "/fleet", KeyH: "/hr", KeyR: "/reports", KeyL: "/activity-log",
          KeyG: "/profit", KeyT: "/settings", KeyC: "/customers", KeyO: "/procurement",
          KeyA: "/accounting", KeyM: "/marketing", KeyK: "/sub-accounts",
          KeyE: "/attendance", KeyY: "/payroll", KeyU: "/invoices",
        };
        const path = map[e.code];
        if (path) { e.preventDefault(); e.stopPropagation(); navigate(path); return; }
      }

      // Ctrl+Alt+N = new item
      if (e.ctrlKey && e.altKey && e.code === "KeyN" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        onNewItem?.();
        return;
      }

      // Ctrl+Alt+Delete = delete
      if (e.ctrlKey && e.altKey && e.code === "Delete" && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        onDelete?.();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, globalSearchOpen, setGlobalSearchOpen, helpOpen, toggleHelp, closeHelp, onNewItem, onSave, onDelete, onRefresh, onExport]);

  return { helpOpen, setHelpOpen, shortcuts: DEFAULT_SHORTCUTS, toggleHelp };
}
