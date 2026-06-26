import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { usePricingStore, type ProductPrice } from "@/hooks/use-pricing-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useProcurementStore } from "@/hooks/use-procurement-store";
import { fmtDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SmartInput from "@/components/SmartInput";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, DollarSign, TrendingUp, History, Save, X, RefreshCw,
  Package, AlertTriangle, XCircle, ChevronDown, ChevronUp, Beaker,
  Wheat, Bean, Leaf, FlaskConical, Pill, Check,
  Plus, Layers, ShoppingBag, PiggyBank, ArrowUpDown,
  BarChart3, Download
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MagItem } from "@/components/ui/magnifier";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MATERIAL_CATALOG } from "@/lib/substitution-engine";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const fmtCurrency = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

const GROUP_ACCENTS: Record<string, { dot: string; badge: string }> = {
  corn:       { dot: "bg-amber-500",    badge: "bg-amber-950/40 text-amber-300 border-amber-700/40" },
  soy:        { dot: "bg-blue-500",     badge: "bg-blue-950/40 text-blue-300 border-blue-700/40" },
  wheat_bran: { dot: "bg-orange-500",   badge: "bg-orange-950/40 text-orange-300 border-orange-700/40" },
  gluten:     { dot: "bg-purple-500",   badge: "bg-purple-950/40 text-purple-300 border-purple-700/40" },
  premix:     { dot: "bg-teal-500",     badge: "bg-teal-950/40 text-teal-300 border-teal-700/40" },
};



const groupMeta: Record<string, { label: string; icon: React.ReactNode }> = {
  corn:       { label: "الذرة",     icon: <Wheat className="w-5 h-5" /> },
  soy:        { label: "الصويا",    icon: <Bean className="w-5 h-5" /> },
  wheat_bran: { label: "النخالة",   icon: <Leaf className="w-5 h-5" /> },
  gluten:     { label: "الجلوتين",  icon: <FlaskConical className="w-5 h-5" /> },
  premix:     { label: "البريمكس",  icon: <Pill className="w-5 h-5" /> },
};

const priceFields: { key: keyof ProductPrice; label: string; en: string; color: string }[] = [
  { key: "costPrice",       label: "التكلفة",       en: "Cost",        color: "text-orange-600" },
  { key: "wholeSalePrice",  label: "الجملة",        en: "Wholesale",   color: "text-sky-600" },
  { key: "retailPrice",     label: "القطاعي",       en: "Retail",      color: "text-emerald-600" },
  { key: "distributorPrice",label: "الموزع",        en: "Distributor", color: "text-violet-600" },
  { key: "minSalePrice",    label: "الحد الأدنى",   en: "Min Sale",    color: "text-rose-600" },
];

const MARGIN_PRESETS = ["10", "15", "20", "25", "30"];
const ALL_COL_KEYS = ["productName", "productCode", "costPrice", "wholeSalePrice", "retailPrice", "distributorPrice", "minSalePrice", "margin"] as const;
type ColKey = typeof ALL_COL_KEYS[number];

function MobileProductCard({ p, stock, margin, isBelowCost, formula, showFormula, isExpanded, onToggleFormula, onEdit, editing, editValue, onEditChange, onSave, onCancel, onHistory, onStartEdit, costPrice, allPrices, magnify }: any) {
  const { t } = useAppStore();
  return (
    <Card className="p-4 md:p-5 space-y-3 md:space-y-4 border-border/50 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm md:text-base font-bold leading-tight">{p.productName}</p>
            <Badge variant="outline" className="text-[9px] md:text-[10px] h-4 md:h-5 px-1.5 font-normal shrink-0">{p.category}</Badge>
            <span className="text-[10px] md:text-xs text-muted-foreground font-mono shrink-0">{p.productCode}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] md:text-xs text-muted-foreground">{t("المخزون", "Stock")}:</span>
              <span className={`text-xs md:text-sm font-bold tabular-nums ${stock < 1 ? "text-red-500" : "text-foreground"}`}>{fmtNum(stock)} {t("ط", "T")}</span>
            </div>
            <span className="w-px h-4 bg-border/40" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] md:text-xs text-muted-foreground">{t("الهامش", "Margin")}:</span>
              <span className={`text-xs md:text-sm font-bold tabular-nums ${margin > 20 ? "text-emerald-600" : margin > 10 ? "text-amber-600" : "text-red-500"}`}>
                {costPrice ? (
                  magnify ? (
                    <MagItem label={`${margin}%`} detail={t("الهامش", "Margin")} big={`${margin}%`} sub="" className="inline-block" ringColor={margin > 20 ? "hsl(160,60%,50%)" : margin > 10 ? "hsl(40,90%,55%)" : "hsl(0,70%,55%)"}>
                      {margin > 0 ? "+" : ""}{margin}%
                    </MagItem>
                  ) : `${margin > 0 ? "+" : ""}${margin}%`
                ) : "—"}
              </span>
            </div>
            {isBelowCost && (
              <Badge variant="outline" className="text-[9px] md:text-[10px] h-4 md:h-5 px-1.5 border-red-300 text-red-600 bg-red-50">
                <AlertTriangle className="w-2.5 h-2.5 ml-0.5" />{t("أقل من التكلفة", "Below cost")}
              </Badge>
            )}
          </div>
        </div>
        <button onClick={onHistory} className="text-muted-foreground/30 hover:text-primary transition-colors p-1.5 shrink-0 rounded-lg hover:bg-muted/50">
          <History className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      {/* Price fields grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
        {priceFields.map(f => (
          <div key={f.key} className="rounded-lg border border-border/30 p-2.5 md:p-3 bg-muted/10">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[9px] md:text-[10px] font-semibold text-muted-foreground">{t(f.label, f.en)}</span>
              {editing?.id === p.productId && editing?.field === f.key ? null : (
                <button onClick={() => onStartEdit(p.productId, f.key)}
                  className="text-muted-foreground/20 hover:text-primary transition-colors p-0.5">
                  <svg className="w-3 h-3 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
              )}
            </div>
            {editing?.id === p.productId && editing?.field === f.key ? (
              <div className="flex items-center gap-1">
                <Input type="number" value={editValue} onChange={onEditChange}
                  className="h-8 md:h-9 text-xs md:text-sm text-center flex-1" autoFocus
                  onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }} />
                <button onClick={onSave} className="text-primary p-1 hover:bg-primary/10 rounded"><Save className="w-3.5 h-3.5" /></button>
                <button onClick={onCancel} className="text-muted-foreground p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <motion.p
                key={`mp-${p.productId}-${f.key}-${p[f.key]}`}
                initial={{ opacity: 0.3, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                className={`text-sm md:text-base font-extrabold tabular-nums text-foreground ${f.key === "wholeSalePrice" && isBelowCost ? "text-red-500" : ""}`}>
                {(p[f.key] as number) > 0 ? (
                  magnify ? (
                    <MagItem label={fmtCurrency(p[f.key] as number)} detail={f.label} big={fmtCurrency(p[f.key] as number)} sub={t("/ط", "/T")} className="inline-block" ringColor="hsl(var(--primary))">
                      {fmtCurrency(p[f.key] as number)}
                    </MagItem>
                  ) : fmtCurrency(p[f.key] as number)
                ) : "—"}
              </motion.p>
            )}
          </div>
        ))}
      </div>

      {/* Formula */}
      {showFormula && (
        <div className="rounded-lg border border-white/10 bg-[#1e2130] p-2.5 md:p-3">
          <button onClick={onToggleFormula} className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <Beaker className="w-3.5 h-3.5 md:w-4 md:h-4 text-violet-400" />
              <span className="text-[10px] md:text-xs font-semibold text-violet-300">{t("التركيبة", "Formula")}</span>
              <span className="text-[9px] md:text-[10px] text-violet-400/70">({formula.length} {t("مكون", "ingredients")})</span>
            </div>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-violet-400" /> : <ChevronDown className="w-3.5 h-3.5 text-violet-400" />}
          </button>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/10">
              {formula.map((ing: any, fi: number) => {
                const ingCost = allPrices.find((pp: ProductPrice) => pp.productName === ing.material)?.costPrice ||
                  (() => { for (const g of Object.values(MATERIAL_CATALOG)) { const m = (g as any[]).find((x: any) => x.name === ing.material); if (m) return m.pricePerTon; } return 0; })();
                return (
                  <div key={fi} className="flex items-center gap-1.5 bg-[#161922] rounded-md px-2.5 py-1.5 text-[10px] md:text-xs border border-white/5 shadow-sm">
                    <span className="font-semibold text-white/90">{ing.material}</span>
                    <span className="text-white/50">{ing.pct}%</span>
                    <span className="w-px h-3 bg-white/10" />
                    <span className="text-orange-400 font-semibold">{fmtCurrency(Math.round((ing.pct / 100) * ingCost))}</span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <span className="text-[9px] md:text-[10px] text-muted-foreground">
          {t("آخر تحديث", "Last updated")}: {p.lastUpdated}
        </span>
      </div>
    </Card>
  );
}

export default function Pricing() {
  const { t } = useAppStore();
  const store = usePricingStore();
  const {
    productPrices, pricingAlerts, updatePrice, recalculateCostPrices, dismissPricingAlert,
    dismissAllAlerts, applySuggestedPrice, calculateFormulaCost, recalculateFormulaCosts,
    groupExtraItems, groupCustomNames, groupCustomMargins, customGroups,
    addItemToGroup, removeItemFromGroup, setGroupCustomName, setGroupMargin,
    addCustomGroup, removeCustomGroup, bulkUpdatePrices,
  } = store;
  const { inventory, formulas } = useProductionStore();
  const [searchQ, setSearchQ] = useState("");
  const [editing, setEditing] = useState<{ id: string; field: keyof ProductPrice } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [historyProduct, setHistoryProduct] = useState<ProductPrice | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);
  const [tab, setTab] = useState<"groups" | "all">("groups");

  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editingGroupNameVal, setEditingGroupNameVal] = useState("");
  const [editingGroupPrice, setEditingGroupPrice] = useState<string | null>(null);
  const [editingGroupPriceVal, setEditingGroupPriceVal] = useState("");
  const [showBelowCost, setShowBelowCost] = useState(false);
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [tableMode, setTableMode] = useState<"unified" | "individual">("unified");
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupSearch, setGroupSearch] = useState<Record<string, string>>({});
  const [magnify, setMagnify] = useState(false);
  const [pricingItem, setPricingItem] = useState<string | null>(null);
  const [piCode, setPiCode] = useState("");
  const [piCost, setPiCost] = useState("");
  const [piWholesale, setPiWholesale] = useState("");
  const [piRetail, setPiRetail] = useState("");
  const [piDistributor, setPiDistributor] = useState("");
  const [piMinSale, setPiMinSale] = useState("");

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repPriceList, setRepPriceList] = useState(true);
  const [repAlerts, setRepAlerts] = useState(true);
  const [repMargins, setRepMargins] = useState(true);
  const [visibleCols, setVisibleCols] = useState<ColKey[]>([...ALL_COL_KEYS]);
  const visibleColsRef = useRef(visibleCols);
  useEffect(() => { visibleColsRef.current = visibleCols; }, [visibleCols]);

  const getGroupLabel = useCallback((groupName: string) =>
    groupCustomNames[groupName] || groupMeta[groupName]?.label || groupName,
  [groupCustomNames]);

  const availableItems = useMemo(() => {
    const names = new Set<string>();
    inventory.filter(i => i.type === "raw" && i.quantity > 0).forEach(i => names.add(i.materialName));
    productPrices.forEach(p => names.add(p.productName));
    return [...names];
  }, [inventory, productPrices]);

  const materialGroups = useMemo(() => {
    const result: { groupName: string; items: ProductPrice[]; avgCost: number; avgWholesale: number }[] = [];
    for (const [groupName, catalogItems] of Object.entries(MATERIAL_CATALOG)) {
      const items = catalogItems.map(c => productPrices.find(p => p.productName === c.name)).filter((p): p is ProductPrice => !!p);
      for (const name of (groupExtraItems[groupName] || [])) {
        if (!items.find(i => i.productName === name)) {
          const match = productPrices.find(p => p.productName === name);
          if (match) items.push(match);
        }
      }
      if (items.length === 0) continue;
      const avgCost = Math.round(items.reduce((s, p) => s + (p.costPrice || 0), 0) / items.length);
      const avgWholesale = Math.round(items.reduce((s, p) => s + p.wholeSalePrice, 0) / items.length);
      result.push({ groupName, items, avgCost, avgWholesale });
    }
    for (const g of customGroups) {
      if (MATERIAL_CATALOG[g]) continue;
      const items: ProductPrice[] = [];
      for (const name of (groupExtraItems[g] || [])) {
        const match = productPrices.find(p => p.productName === name);
        if (match) items.push(match);
      }
      const avgCost = items.length > 0 ? Math.round(items.reduce((s, p) => s + (p.costPrice || 0), 0) / items.length) : 0;
      const avgWholesale = items.length > 0 ? Math.round(items.reduce((s, p) => s + p.wholeSalePrice, 0) / items.length) : 0;
      result.push({ groupName: g, items, avgCost, avgWholesale });
    }
    return result;
  }, [productPrices, groupExtraItems, customGroups]);

  const applyGroupPrice = useCallback((groupName: string, price: number) => {
    const group = materialGroups.find(g => g.groupName === groupName);
    if (!group) return;
    const ids = group.items.map(i => i.productId);
    bulkUpdatePrices(ids, "wholeSalePrice", price);
    bulkUpdatePrices(ids, "retailPrice", Math.round(price * 1.08));
    bulkUpdatePrices(ids, "distributorPrice", Math.round(price * 0.95));
    bulkUpdatePrices(ids, "minSalePrice", Math.round(price * 0.9));
  }, [materialGroups, bulkUpdatePrices]);

  const unpricedItems = useMemo(() => {
    const pricedNames = new Set(productPrices.filter(p => p.costPrice > 0 || p.wholeSalePrice > 0).map(p => p.productName));
    const fromInventory = inventory.filter(i => i.quantity > 0 && !pricedNames.has(i.materialName)).map(i => ({ name: i.materialName, source: "inventory" as const }));
    const fromProcurementItems = useProcurementStore.getState().orders.flatMap(o => o.items.map(i => i.material));
    const fromProcurement = [...new Set(fromProcurementItems)].filter(name => !pricedNames.has(name)).map(name => ({ name, source: "procurement" as const }));
    return [...fromInventory, ...fromProcurement].filter((v, i, a) => a.findIndex(x => x.name === v.name) === i);
  }, [productPrices, inventory]);

  const filtered = useMemo(() => {
    let list = productPrices;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(p =>
        p.productName.toLowerCase().includes(q) ||
        p.productCode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q));
    }
    if (showBelowCost) {
      list = list.filter(p => p.costPrice > 0 && p.wholeSalePrice > 0 && p.wholeSalePrice < p.costPrice);
    }
    return list;
  }, [productPrices, searchQ, showBelowCost]);

  const getStock = (productId: string) =>
    inventory.filter(i => i.type === "finished" && i.materialName.includes(productPrices.find(p => p.productId === productId)?.productName.slice(0, 6) || ""))
      .reduce((sum, i) => sum + (i.unit === "ton" ? i.quantity : i.quantity / 1000), 0);

  const startEdit = (id: string, field: keyof ProductPrice) => {
    const p = productPrices.find(x => x.productId === id);
    if (!p) return;
    setEditing({ id, field });
    setEditValue(String((p[field] as number) || 0));
  };
  const saveEdit = (moveNext?: boolean) => {
    if (!editing) return;
    const val = parseFloat(editValue);
    if (!isNaN(val)) updatePrice(editing.id, editing.field, val);
    if (moveNext) {
      const currentIdx = filtered.findIndex(p => p.productId === editing.id);
      const fieldIdx = priceFields.findIndex(f => f.key === editing.field);
      if (fieldIdx < priceFields.length - 1) {
        startEdit(editing.id, priceFields[fieldIdx + 1].key);
      } else if (currentIdx < filtered.length - 1) {
        startEdit(filtered[currentIdx + 1].productId, priceFields[0].key);
      } else {
        setEditing(null);
      }
    } else {
      setEditing(null);
    }
  };
  const cancelEdit = () => setEditing(null);
  const handleRecalc = () => { setSaving(true); recalculateCostPrices(); setTimeout(() => setSaving(false), 500); };

  const alertsActive = pricingAlerts.filter(a => !a.dismissed);

  // ── Pricing Report ──
  const handleGenerateReport = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };
  const handleDownloadPDF = () => {
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const vc = visibleColsRef.current;
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = repDateMode === "all" ? t("كل الفترة", "All Period") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;
    const fmtCurrency2 = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
    
    const rptProducts = productPrices || [];
    const allAlerts = pricingAlerts || [];
    const allMargins = productPrices.filter(p => p.costPrice > 0) || [];
    
    const styles = `
      @page{size:A4 portrait;margin:15mm 18mm}
      body{font-family:'Segoe UI',Tahoma,sans-serif;direction:rtl;color:#1e293b;line-height:1.7;font-size:12px}
      .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:120px;font-weight:900;color:rgba(37,99,235,.04);pointer-events:none;z-index:-1;letter-spacing:8px;white-space:nowrap}
      .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:22px;gap:20px}
      .header-right{text-align:right}.header-left{text-align:left;color:#64748b;font-size:11px;line-height:1.5}
      .header h1{font-size:20px;margin:0 0 2px;color:#1d4ed8;font-weight:800}
      .header .sub{font-size:12px;color:#64748b;margin:0}
      .header .company{font-size:13px;font-weight:700;color:#1e293b}
      .meta{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:20px;padding:8px 12px;background:#f8fafc;border-radius:6px}
      .section{margin-bottom:20px}
      .section h2{font-size:14px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:0 0 10px;color:#1d4ed8;font-weight:700;display:flex;align-items:center;gap:6px}
      .section h2:before{content:'';display:inline-block;width:4px;height:16px;background:#1d4ed8;border-radius:2px}
      .grid{display:flex;gap:8px;flex-wrap:wrap}
      .card{flex:1;min-width:90px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 8px;text-align:center;background:#fff}
      .card .num{font-size:18px;font-weight:800}.card .lbl{font-size:10px;color:#64748b;margin-top:2px}
      .num-blue{color:#1d4ed8}.num-green{color:#15803d}.num-red{color:#dc2626}.num-amber{color:#b45309}
      table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11px;border-radius:6px;overflow:hidden}
      th{background:#1d4ed8;color:#fff;font-weight:600;padding:7px 6px;font-size:11px}
      td{border:1px solid #e2e8f0;padding:6px}
      tr:nth-child(even){background:#f8fafc}
      .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:500}
      .badge-green{background:#dcfce7;color:#15803d}.badge-red{background:#fee2e2;color:#dc2626}.badge-amber{background:#fef3c7;color:#b45309}.badge-blue{background:#dbeafe;color:#1d4ed8}
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
    `;
    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right"><h1>${t("تقرير التسعير", "Pricing Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>📦 ${rptProducts.length} ${t("منتج", "product(s)")}</span><span>⚠️ ${allAlerts.length} ${t("تنبيه", "alert(s)")}</span></div>
      ${repPriceList && rptProducts.length > 0 ? `
      <div class="section"><h2>${t("قائمة الأسعار", "Price List")}</h2>
        <table><tr>${vc.includes("productName") ? `<th>${t("المنتج","Product")}</th>` : ""}${vc.includes("productCode") ? `<th>${t("كود","Code")}</th>` : ""}${vc.includes("costPrice") ? `<th>${t("التكلفة","Cost")}</th>` : ""}${vc.includes("wholeSalePrice") ? `<th>${t("الجملة","Wholesale")}</th>` : ""}${vc.includes("retailPrice") ? `<th>${t("القطاعي","Retail")}</th>` : ""}${vc.includes("distributorPrice") ? `<th>${t("الموزع","Distributor")}</th>` : ""}${vc.includes("minSalePrice") ? `<th>${t("الحد الأدنى","Min")}</th>` : ""}${vc.includes("margin") ? `<th>${t("الهامش","Margin")}</th>` : ""}</tr>
        ${rptProducts.slice(0, 50).map(p => {
          const cp = p.costPrice || 0;
          const margin = cp > 0 ? Math.round(((p.wholeSalePrice - cp) / cp) * 100) : 0;
          return `<tr>${vc.includes("productName") ? `<td><strong>${p.productName}</strong></td>` : ""}${vc.includes("productCode") ? `<td>${p.productCode}</td>` : ""}${vc.includes("costPrice") ? `<td>${fmtCurrency2(cp)}</td>` : ""}${vc.includes("wholeSalePrice") ? `<td>${fmtCurrency2(p.wholeSalePrice)}</td>` : ""}${vc.includes("retailPrice") ? `<td>${fmtCurrency2(p.retailPrice)}</td>` : ""}${vc.includes("distributorPrice") ? `<td>${fmtCurrency2(p.distributorPrice)}</td>` : ""}${vc.includes("minSalePrice") ? `<td>${fmtCurrency2(p.minSalePrice)}</td>` : ""}${vc.includes("margin") ? `<td style="color:${margin >= 20 ? "#15803d" : margin >= 10 ? "#b45309" : "#dc2626"};font-weight:600">%${margin}</td>` : ""}</tr>`;
        }).join("")}
        ${rptProducts.length > 50 ? `<tr><td colspan="${vc.length}" style="text-align:center;color:#94a3b8">... ${t("و", "and")} ${rptProducts.length - 50} ${t("منتج آخر", "more products")}</td></tr>` : ""}
        </table>
      </div>` : ""}
      ${repAlerts && allAlerts.length > 0 ? `
      <div class="section"><h2>${t("تنبيهات التسعير", "Pricing Alerts")} (${allAlerts.length})</h2>
        <table><tr><th>${t("المنتج", "Product")}</th><th>${t("التكلفة", "Cost")}</th><th>${t("السبب", "Reason")}</th><th>${t("التاريخ", "Date")}</th></tr>
        ${allAlerts.slice(0, 30).map(a => `<tr><td><strong>${a.productName || "—"}</strong></td><td>${fmtCurrency2(a.costPrice)}</td><td><span class="${a.reason === "production" ? "badge badge-blue" : "badge badge-amber"}">${a.reason === "production" ? t("إنتاج", "Production") : t("مشتريات", "Procurement")}</span></td><td>${new Date(a.date).toLocaleDateString("ar-EG")}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      ${repMargins ? `
      <div class="section"><h2>${t("الهوامش", "Margins")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-green">${allMargins.filter(m => m.costPrice > 0 && m.wholeSalePrice > 0 && ((m.wholeSalePrice - m.costPrice) / m.costPrice * 100) >= 20).length}</div><div class="lbl">${t("هامش >= 20%", "Margin >= 20%")}</div></div>
          <div class="card"><div class="num num-amber">${allMargins.filter(m => m.costPrice > 0 && m.wholeSalePrice > 0 && ((m.wholeSalePrice - m.costPrice) / m.costPrice * 100) >= 10 && ((m.wholeSalePrice - m.costPrice) / m.costPrice * 100) < 20).length}</div><div class="lbl">${t("هامش 10-20%", "Margin 10-20%")}</div></div>
          <div class="card"><div class="num num-red">${allMargins.filter(m => m.costPrice > 0 && m.wholeSalePrice > 0 && ((m.wholeSalePrice - m.costPrice) / m.costPrice * 100) < 10).length}</div><div class="lbl">${t("هامش < 10%", "Margin < 10%")}</div></div>
        </div>
      </div>` : ""}
      <div class="footer"><p><span class="footer-logo">${companyName || "تاج"}</span> — ${t("جميع الحقوق محفوظة", "All rights reserved")} © ${new Date().getFullYear()}</p><p style="margin-top:2px">${t("تم إنشاؤه بواسطة", "Generated by")} تاج — ${nowStr}</p></div>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>' + styles + '</style></head><body>' + content + '</body></html>');
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="p-3 md:p-6 space-y-3 sm:space-y-6 max-w-full" dir="rtl">
      {/* ═══ HEADER ═══ */}
      <motion.div variants={itemVariants} initial="hidden" animate="show" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            {t("تسعير المنتجات والتكلفة", "Pricing & Cost")}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">
            {t("إدارة أسعار البيع والتكلفة التقديرية حسب التركيبات", "Manage sale prices and formula-based costs")}
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setRepOpen(true)}>
          <BarChart3 className="w-4 h-4" />{t("تقرير", "Report")}
        </Button>
        <Button variant="outline" className="w-full sm:w-auto gap-2 h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 shrink-0" onClick={handleRecalc} disabled={saving}>
          <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${saving ? "animate-spin" : ""}`} />
          {t("إعادة حساب التكلفة", "Recalc Costs")}
        </Button>
      </motion.div>

      {/* ═══ SUMMARY CARDS ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        {[
          { label: t("المنتجات", "Products"),        value: fmtNum(productPrices.length),                       icon: Package,    color: "from-blue-500 to-blue-600" },
          { label: t("متوسط الجملة", "Avg Wholesale"), value: fmtCurrency(Math.round(productPrices.reduce((s, p) => s + Number(p.wholeSalePrice), 0) / (productPrices.length || 1))), icon: DollarSign,  color: "from-primary to-primary/80" },
          { label: t("أعلى هامش", "Highest Margin"),  value: (() => { const m = Math.max(...productPrices.filter(p => Number(p.costPrice) > 0).map(p => ((Number(p.wholeSalePrice) - Number(p.costPrice)) / Number(p.costPrice)) * 100), 0); return `${Math.round(m)}%`; })(), icon: TrendingUp,  color: "from-emerald-500 to-emerald-600" },
          { label: t("متوسط التكلفة", "Avg Cost"),     value: fmtCurrency(Math.round(productPrices.reduce((s, p) => s + Number(p.costPrice || 0), 0) / (productPrices.length || 1))), icon: ShoppingBag, color: "from-orange-500 to-orange-600" },
        ].map((stat, i) => (
          <Card key={i} className="p-3 md:p-4 flex items-center gap-3 md:gap-4 border-border/40 shadow-sm">
            <div className={`shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md`}>
              <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">{stat.label}</p>
              <p className="text-sm md:text-lg font-bold tabular-nums truncate">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex items-center gap-3 md:gap-4 border-b border-border/40 overflow-x-auto">
        <button onClick={() => setTab("groups")}
          className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-colors relative shrink-0 ${tab === "groups" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <span className="flex items-center gap-1 md:gap-1.5">
            <Layers className="w-3.5 h-3.5 md:w-4 md:h-4" />
            {t("مجموعات المواد", "Material Groups")}
          </span>
          {tab === "groups" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
        </button>
        <button onClick={() => setTab("all")}
          className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-colors relative shrink-0 ${tab === "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <span className="flex items-center gap-1 md:gap-1.5">
            <Package className="w-3.5 h-3.5 md:w-4 md:h-4" />
            {t("كل المنتجات", "All Products")}
          </span>
          {tab === "all" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
        </button>
      </div>

      {/* ═══ MATERIAL GROUPS ═══ */}
      {tab === "groups" && (
        <div className="space-y-3 sm:space-y-4">
          {/* Add new group toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {addingGroup ? (
              <div className="flex items-center gap-1.5">
                <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  placeholder={t("اسم المجموعة الجديدة", "New group name")}
                  className="h-9 text-xs md:text-sm w-36 md:w-56" autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && newGroupName.trim()) { addCustomGroup(newGroupName.trim()); setNewGroupName(""); setAddingGroup(false); } if (e.key === "Escape") setAddingGroup(false); }}
                  onBlur={() => { if (newGroupName.trim()) { addCustomGroup(newGroupName.trim()); setNewGroupName(""); } setAddingGroup(false); }} />
                <Button size="sm" className="h-9 gap-1"
                  onClick={() => { if (newGroupName.trim()) { addCustomGroup(newGroupName.trim()); setNewGroupName(""); setAddingGroup(false); } }}>
                  <Check className="w-4 h-4" /> {t("حفظ", "Save")}
                </Button>
                <Button size="sm" variant="ghost" className="h-9"
                  onClick={() => { setAddingGroup(false); setNewGroupName(""); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full sm:w-auto h-9 text-xs md:text-sm gap-1.5 border-dashed border-primary/40 hover:border-primary"
                onClick={() => setAddingGroup(true)}>
                <Plus className="w-4 h-4" /> {t("إضافة مجموعة جديدة", "Add new group")}
              </Button>
            )}
          </div>

          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-[1.2rem]">
          {materialGroups.map(group => {
            const accent = GROUP_ACCENTS[group.groupName] || { dot: "bg-muted", badge: "bg-muted text-muted-foreground border-border" };
            const meta = groupMeta[group.groupName] || { label: group.groupName, icon: <Package className="w-5 h-5" /> };
            const groupLabel = getGroupLabel(group.groupName);
            const marginPct = groupCustomMargins[group.groupName] || "15";
            const suggestedPrice = Math.round(group.avgCost * (1 + parseFloat(marginPct) / 100));
            const isEditingPrice = editingGroupPrice === group.groupName;

            return (
              <motion.div key={group.groupName} variants={itemVariants}>
              <Card className="shadow-sm border-border/50 overflow-hidden">
                {/* ── Header ── */}
                <div className="flex items-center gap-1.5 px-3 md:px-4 pt-3 md:pt-4 pb-2 flex-wrap">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${accent.dot}`} />
                  {editingGroupName === group.groupName ? (
                    <Input value={editingGroupNameVal} onChange={e => setEditingGroupNameVal(e.target.value)}
                      className="h-7 md:h-8 w-32 md:w-40 text-sm" autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter") { setGroupCustomName(group.groupName, editingGroupNameVal); setEditingGroupName(null); }
                        if (e.key === "Escape") setEditingGroupName(null);
                      }}
                      onBlur={() => { if (editingGroupNameVal) setGroupCustomName(group.groupName, editingGroupNameVal); setEditingGroupName(null); }} />
                  ) : (
                    <button onClick={() => { setEditingGroupName(group.groupName); setEditingGroupNameVal(groupLabel); }}
                      className="text-base md:text-lg font-bold hover:text-primary transition-colors">
                      {groupLabel}
                    </button>
                  )}
                  {!MATERIAL_CATALOG[group.groupName] && (
                    <button onClick={() => removeCustomGroup(group.groupName)}
                      className="text-muted-foreground/30 hover:text-red-500 transition-colors p-0.5 shrink-0">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="text-xs md:text-sm text-muted-foreground mx-1 shrink-0">·</span>
                  <div className="whitespace-nowrap inline-flex items-center rounded-md py-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover-elevate border text-[9px] md:text-[10px] h-4 md:h-5 px-1.5 md:px-2 font-normal bg-muted/50 text-muted-foreground border-border/40">
                    {group.items.length} {t("صنف", "items")}
                  </div>
                  <div className="mr-auto flex items-center gap-1.5 md:gap-2 shrink min-w-0">
                    <span className="text-[10px] md:text-xs text-muted-foreground">{t("متوسط التكلفة", "Avg Cost")}:</span>
                    <span className="text-base md:text-2xl font-extrabold tabular-nums tracking-tight">{fmtCurrency(group.avgCost)}</span>
                  </div>
                </div>

                {/* ── Items ── */}
                <div className="px-3 md:px-4 pb-2">
                  <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
                    {group.items.map(item => {
                      const isExtra = (groupExtraItems[group.groupName] || []).includes(item.productName);
                      return (
                        <div key={item.productId}
                          className="group/chip flex items-center gap-1.5 md:gap-2 bg-muted/30 border border-border/40 rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs hover:border-primary/30 hover:bg-primary/[0.02] transition-all">
                          <span className="font-medium">{item.productName}</span>
                          <span className="w-px h-3 md:h-4 bg-border/40" />
                          <span className={item.costPrice > 0 ? "text-orange-600 font-bold" : "text-muted-foreground/40"}>
                            {fmtCurrency(item.costPrice || 0)}
                          </span>
                          {isExtra && (
                            <button onClick={() => removeItemFromGroup(group.groupName, item.productName)}
                              className="opacity-0 group-hover/chip:opacity-100 text-red-400 hover:text-red-600 transition-all">
                              <XCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1 text-[10px] md:text-xs text-primary/60 hover:text-primary px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg border border-dashed border-primary/30 hover:border-primary/50 transition-colors">
                          <Plus className="w-3 h-3 md:w-3.5 md:h-3.5" /> {t("إضافة", "Add")}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-56 md:w-72 p-2">
                        <div className="relative mb-1.5">
                          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                          <SmartInput value={groupSearch[group.groupName] || ""} onChange={v => setGroupSearch({ ...groupSearch, [group.groupName]: v })}
                            placeholder={t("ابحث عن صنف...", "Search item...")}
                            extraSuggestions={availableItems}
                            className="h-8 text-xs pr-7 w-full" />
                        </div>
                        <div className="max-h-40 md:max-h-44 overflow-y-auto space-y-0.5">
                          {(() => {
                            const q = (groupSearch[group.groupName] || "").toLowerCase();
                            const filtered = availableItems.filter(name => !group.items.find(i => i.productName === name) && (!q || name.toLowerCase().includes(q)));
                            return filtered.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">{t("لا توجد نتائج", "No results")}</p>
                            ) : (
                              filtered.map(name => (
                                <button key={name} type="button" onClick={() => { addItemToGroup(group.groupName, name); setGroupSearch({ ...groupSearch, [group.groupName]: "" }); }}
                                  className="w-full text-right px-3 py-2 text-xs rounded-lg hover:bg-muted transition-colors">
                                  {name}
                                </button>
                              ))
                            );
                          })()}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* ── Pricing controls ── */}
                <div className="flex flex-wrap items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 border-t border-border/30 bg-muted/20">
                  <span className="text-[10px] md:text-sm font-medium text-muted-foreground shrink-0">{t("الهامش:", "Margin:")}</span>
                  <div className="flex gap-0.5 md:gap-1">
                    {MARGIN_PRESETS.map(pct => (
                      <button key={pct} onClick={() => { setGroupMargin(group.groupName, pct); setEditingGroupPrice(null); }}
                        className={`px-2 md:px-3 py-1 text-[10px] md:text-xs rounded-full transition-all font-medium ${
                          marginPct === pct && !isEditingPrice
                            ? "bg-primary text-white shadow-sm scale-105 border border-primary/60"
                            : "bg-[#161922] text-white hover:bg-[#1e2235] border border-border/40"
                        }`}>
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] md:text-xs text-muted-foreground/50">|</span>
                    <Input value={marginPct} onChange={e => setGroupMargin(group.groupName, e.target.value || "0")}
                      placeholder={t("نسبة", "%")}
                      className="w-12 md:w-16 h-6 md:h-7 text-[10px] md:text-xs border border-input rounded-lg bg-muted/30 px-1.5 md:px-2 text-center" />
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 mr-auto flex-wrap">
                    {isEditingPrice ? (
                      <Input value={editingGroupPriceVal} onChange={e => setEditingGroupPriceVal(e.target.value)}
                        className="w-16 md:w-28 h-8 md:h-9 text-xs md:text-sm text-center font-bold" autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter") { const p = parseInt(editingGroupPriceVal); if (p > 0) { applyGroupPrice(group.groupName, p); setEditingGroupPrice(null); } }
                          if (e.key === "Escape") setEditingGroupPrice(null);
                        }}
                        onBlur={() => { const p = parseInt(editingGroupPriceVal); if (p > 0) { applyGroupPrice(group.groupName, p); } setEditingGroupPrice(null); }} />
                    ) : (
                      <button onClick={() => { setEditingGroupPrice(group.groupName); setEditingGroupPriceVal(String(suggestedPrice)); }}
                        className="text-base md:text-xl font-extrabold tabular-nums tracking-tight border-b-2 border-dashed border-primary/30 hover:border-primary transition-colors">
                        {fmtCurrency(suggestedPrice)}
                      </button>
                    )}
                    <Button className="h-8 md:h-9 text-[10px] md:text-sm gap-1 md:gap-1.5 px-2.5 md:px-4 font-semibold shadow-sm"
                      onClick={() => applyGroupPrice(group.groupName, isEditingPrice ? parseInt(editingGroupPriceVal) || suggestedPrice : suggestedPrice)}>
                      <Check className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="hidden sm:inline">{t("تسعير المجموعة", "Price Group")}</span>
                      <span className="sm:hidden">{t("تسعير", "Price")}</span>
                    </Button>
                  </div>
                </div>
              </Card>
              </motion.div>
            );
          })}
          {materialGroups.length === 0 && (
            <motion.div variants={itemVariants}><Card className="p-3 sm:p-6 md:p-8 text-center text-muted-foreground text-sm col-span-full">{t("لا توجد مجموعات مواد", "No material groups found")}</Card></motion.div>
          )}
          </motion.div>
        </div>
      )}

      {/* ═══ ALL PRODUCTS ═══ */}
      {tab === "all" && (
        <div className="space-y-3 md:space-y-4">
          {/* Unpriced items alert */}
          <AnimatePresence>
            {unpricedItems.length > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <Card className="p-2.5 md:p-3 border-orange-500/30 bg-orange-950/15 shadow-sm">
                  <div className="flex items-center justify-between gap-1.5 md:gap-2">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-400" />
                      <span className="text-xs md:text-sm font-semibold text-orange-300">{t("عناصر غير مسعرة", "Unpriced items")}</span>
                      <Badge variant="outline" className="text-[9px] md:text-[10px] h-4 md:h-5 px-1.5 border-orange-500/40 text-orange-300 bg-orange-950/30">{unpricedItems.length}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 md:h-7 text-[10px] md:text-xs text-orange-300 hover:text-orange-200 hover:bg-orange-950/30 px-2"
                      onClick={() => setShowUnpriced(!showUnpriced)}>{showUnpriced ? t("إخفاء", "Hide") : t("عرض", "Show")}</Button>
                  </div>
                  {showUnpriced && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5 mt-2">
                      {unpricedItems.map((item, i) => {
                        const invItem = inventory.find(x => x.materialName === item.name);
                        const autoCode = invItem
                          ? (invItem.type === "raw" ? "RAW-" : "FIN-") + item.name.replace(/[^\w]/g, "").slice(0, 6).toUpperCase()
                          : "RAW-" + item.name.replace(/[^\w]/g, "").slice(0, 6).toUpperCase();
                        return (
                          <button key={i} onClick={() => {
                            setPricingItem(item.name);
                            setPiCode(autoCode);
                            setPiCost("");
                            setPiWholesale("");
                            setPiRetail("");
                            setPiDistributor("");
                            setPiMinSale("");
                          }} className="w-full flex items-center gap-2 bg-orange-100/50 dark:bg-orange-950/30 hover:bg-orange-200/60 dark:hover:bg-orange-950/50 rounded-md md:rounded-lg px-3 py-1.5 text-[10px] md:text-xs border border-orange-300/40 dark:border-orange-500/20 shadow-sm transition-colors cursor-pointer text-right">
                            <span className="font-semibold text-orange-700 dark:text-orange-200 min-w-0 flex-1">{item.name}</span>
                            <span className="font-mono text-[9px] md:text-[10px] text-orange-500/70 dark:text-orange-400/60 shrink-0">{autoCode}</span>
                            <span className="text-orange-400/30">·</span>
                            <Badge variant="secondary" className="text-[8px] md:text-[9px] h-3.5 md:h-4 px-1 font-normal shrink-0">
                              {item.source === "inventory" ? t("مخزون", "Inv.") : t("مشتريات", "Purch.")}
                            </Badge>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search + toggles */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-full md:max-w-sm">
              <Search className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground pointer-events-none" />
              <SmartInput value={searchQ} onChange={setSearchQ}
                placeholder={t("بحث منتج...", "Search product...")}
                extraSuggestions={productPrices.map(p => p.productName)}
                className="h-9 md:h-10 text-xs md:text-sm pr-9 md:pr-10 w-full" />
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0 flex-wrap">
              <Button variant={showBelowCost ? "default" : "outline"} size="sm"
                className={`w-full sm:w-auto h-8 md:h-9 text-[10px] md:text-xs gap-1 ${showBelowCost ? "bg-red-600 hover:bg-red-700" : "border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-950/20"}`}
                onClick={() => setShowBelowCost(!showBelowCost)}>
                <AlertTriangle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                {t("أقل من التكلفة", "Below cost")}
                {showBelowCost && <X className="w-3 h-3" onClick={e => { e.stopPropagation(); setShowBelowCost(false); }} />}
              </Button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto h-8 md:h-9 text-[10px] md:text-xs gap-1 inline-flex items-center justify-center rounded-md px-3 font-medium transition-colors ${magnify ? "bg-primary text-primary-foreground shadow" : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"}`}
                onClick={() => setMagnify(!magnify)}>
                <Search className={`w-3 h-3 md:w-3.5 md:h-3.5 ${magnify ? "scale-110" : ""}`} />
                {t("تكبير", "Zoom")}
              </motion.button>
              <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/40">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} onClick={() => setTableMode("unified")}
                  className={`px-2 md:px-3 py-1 text-[10px] md:text-xs rounded-md font-medium transition-colors ${tableMode === "unified" ? "bg-primary/10 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}>
                  {t("جدول", "Table")}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} onClick={() => setTableMode("individual")}
                  className={`px-2 md:px-3 py-1 text-[10px] md:text-xs rounded-md font-medium transition-colors ${tableMode === "individual" ? "bg-primary/10 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}>
                  {t("بطاقات", "Cards")}
                </motion.button>
              </div>
            </div>
          </div>

          {/* ── Desktop view ── */}
          <AnimatePresence mode="wait">
          {tableMode === "unified" ? (
          <motion.div key="table" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="hidden md:block overflow-x-auto rounded-xl border border-border/40 shadow-sm">
            <table className="w-full text-sm min-w-[900px]" dir="rtl">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground border-b border-border/40">
                  <th className="text-right p-3 font-semibold text-xs">{t("المنتج", "Product")}</th>
                  <th className="text-right p-3 font-semibold text-xs">{t("كود", "Code")}</th>
                  <th className="text-center p-3 font-semibold text-xs">{t("المخزون", "Stock")}</th>
                  <th className="text-center p-3 font-semibold text-xs">{t("التركيبة", "Formula")}</th>
                  {priceFields.map(f => (
                    <th key={f.key} className={`text-center p-3 font-semibold text-xs ${f.color}`}>{t(f.label, f.en)}</th>
                  ))}
                  <th className="text-center p-3 font-semibold text-xs">{t("الهامش", "Margin")}</th>
                  <th className="text-center p-3 font-semibold text-xs">{t("آخر تحديث", "Updated")}</th>
                  <th className="text-center p-3 font-semibold text-xs"></th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {filtered.map((p, idx) => {
                  const stock = getStock(p.productId);
                  const costPrice = p.costPrice || 0;
                  const margin = costPrice ? Math.round(((p.wholeSalePrice - costPrice) / costPrice) * 100) : 0;
                  const isBelowCost = costPrice > 0 && p.wholeSalePrice > 0 && p.wholeSalePrice < costPrice;
                  const formula = formulas[p.productId];
                  const showFormula = formula && formula.length > 0;
                  const isExpanded = expandedFormula === p.productId;
                  return (
                    <React.Fragment key={p.productId}>
                      <motion.tr
                        variants={itemVariants}
                        layout
                        className={`border-b border-border/20 transition-colors hover:bg-white/[0.03] ${isBelowCost ? "bg-red-950/20" : idx % 2 === 0 ? "bg-[#161922]" : "bg-white/[0.02]"}`}>
                        <td className="p-3 min-w-[180px]">
                          {(() => {
                            const c = (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-sm leading-tight">{p.productName}</span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">{p.category}</Badge>
                                  {isBelowCost && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-red-500/40 text-red-400 bg-red-950/30">
                                      <AlertTriangle className="w-2.5 h-2.5 ml-0.5" />{t("أقل من التكلفة", "Below cost")}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                            return magnify ? <MagItem label={p.productName} detail={t("المنتج", "Product")} big={p.productName} sub={p.category} ringColor="hsl(var(--primary))">{c}</MagItem> : c;
                          })()}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-xs">
                          {magnify ? <MagItem label={p.productCode} detail={t("الكود", "Code")} big={p.productCode} sub="" ringColor="hsl(var(--muted-foreground))">{p.productCode}</MagItem> : p.productCode}
                        </td>
                        <td className="text-center p-3">
                          {(() => {
                            const c = (
                              <span className={`font-semibold text-xs tabular-nums ${stock < 1 ? "text-red-500" : "text-muted-foreground"}`}>
                                {fmtNum(stock)} {t("ط", "T")}
                              </span>
                            );
                            return magnify ? <MagItem label={`${fmtNum(stock)} ${t("ط", "T")}`} detail={t("المخزون", "Stock")} big={fmtNum(stock)} sub={t("ط", "T")} ringColor={stock < 1 ? "hsl(0,70%,55%)" : "hsl(var(--muted-foreground))"}>{c}</MagItem> : c;
                          })()}
                        </td>
                        <td className="text-center p-3">
                          {(() => {
                            const c = showFormula ? (
                              <button onClick={() => setExpandedFormula(isExpanded ? null : p.productId)}
                                className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700 transition-colors text-xs font-medium">
                                <Beaker className="w-4 h-4" />
                                <span>{formula.length}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            ) : <span className="text-muted-foreground/30">—</span>;
                            return magnify && showFormula ? <MagItem label={`${formula.length} ${t("مكونات", "ingredients")}`} detail={t("التركيبة", "Formula")} big={`${formula.length}`} sub={t("مكون", "ing")} ringColor="hsl(var(--primary))">{c}</MagItem> : c;
                          })()}
                        </td>
                        {priceFields.map(f => (
                          <td key={f.key} className="text-center p-3">
                            {editing?.id === p.productId && editing?.field === f.key ? (
                              <div className="flex items-center justify-center gap-0.5">
                                <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                                  className="w-16 md:w-24 h-8 md:h-9 text-xs text-center" autoFocus
                                  onKeyDown={e => { if (e.key === "Enter") saveEdit(true); if (e.key === "Tab") { e.preventDefault(); saveEdit(true); } if (e.key === "Escape") cancelEdit(); }} />
                                <button onClick={() => saveEdit(true)} className="text-primary p-1"><Save className="w-3.5 h-3.5" /></button>
                                <button onClick={cancelEdit} className="text-muted-foreground p-1"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              (() => {
                                const btn = (
                                  <button onClick={() => startEdit(p.productId, f.key)}
                                    className={`font-semibold text-sm tabular-nums hover:bg-muted rounded-lg px-2 py-1 transition-colors w-full ${
                                      f.key === "costPrice" ? "text-orange-600" :
                                      f.key === "wholeSalePrice" && isBelowCost ? "text-red-500" :
                                      f.key === "wholeSalePrice" ? "text-sky-600" :
                                      f.key === "retailPrice" ? "text-emerald-600" :
                                      f.key === "distributorPrice" ? "text-violet-600" :
                                      "text-muted-foreground"
                                    }`}>
                                    <AnimatePresence mode="wait">
                                      <motion.span
                                        key={`${p.productId}-${f.key}-${p[f.key]}`}
                                        initial={{ opacity: 0.3, scale: 0.85, y: 4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.85, y: -4 }}
                                        transition={{ type: "spring", stiffness: 350, damping: 22 }}
                                      >
                                        {(p[f.key] as number) > 0 ? fmtCurrency(p[f.key] as number) : "—"}
                                      </motion.span>
                                    </AnimatePresence>
                                  </button>
                                );
                                if (magnify && (p[f.key] as number) > 0) {
                                  return (
                                    <MagItem label={fmtCurrency(p[f.key] as number)} detail={f.label} big={fmtCurrency(p[f.key] as number)} sub={t("/ط", "/T")} ringColor="hsl(var(--primary))">
                                      {btn}
                                    </MagItem>
                                  );
                                }
                                return btn;
                              })()
                            )}
                          </td>
                        ))}
                        <td className="text-center p-3">
                          {(() => {
                            const c = (
                              <span className={`font-semibold text-sm tabular-nums ${margin > 20 ? "text-emerald-600" : margin > 10 ? "text-amber-600" : "text-red-500"}`}>
                                {costPrice ? `${margin > 0 ? "+" : ""}${margin}%` : "—"}
                              </span>
                            );
                            return magnify && costPrice ? <MagItem label={`${margin}%`} detail={t("الهامش", "Margin")} big={`${margin}%`} sub="" ringColor={margin > 20 ? "hsl(160,60%,50%)" : margin > 10 ? "hsl(40,90%,55%)" : "hsl(0,70%,55%)"}>{c}</MagItem> : c;
                          })()}
                        </td>
                        <td className="text-center p-3 text-[10px] text-muted-foreground whitespace-nowrap">
                          {magnify ? <MagItem label={p.lastUpdated} detail={t("آخر تحديث", "Last updated")} big={p.lastUpdated} sub="" ringColor="hsl(var(--muted-foreground))">{p.lastUpdated}</MagItem> : p.lastUpdated}
                        </td>
                        <td className="text-center p-3">
                          {(() => {
                            const c = (
                              <button onClick={() => setHistoryProduct(p)} className="text-muted-foreground/30 hover:text-primary transition-colors p-1">
                                <History className="w-4 h-4" />
                              </button>
                            );
                            return magnify ? <MagItem label={t("التاريخ", "History")} detail={t("سجل الأسعار", "Price history")} big="\u{1F4CB}" sub="" ringColor="hsl(var(--primary))">{c}</MagItem> : c;
                          })()}
                        </td>
                      </motion.tr>
                      {showFormula && isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: "spring", stiffness: 200, damping: 25 }}
                          key={`${p.productId}-f`} className="bg-[#161922] border-b border-border/20">
                          <td colSpan={priceFields.length + 6} className="p-3">
                            {(() => {
                              const fc = calculateFormulaCost(p.productId) || 0;
                              const content = (
                                <div className="flex flex-wrap gap-2">
                                  {formula.map((ing: any, fi: number) => {
                                    const ingCost = productPrices.find((pp: ProductPrice) => pp.productName === ing.material)?.costPrice ||
                                      (() => { for (const g of Object.values(MATERIAL_CATALOG)) { const m = (g as any[]).find((x: any) => x.name === ing.material); if (m) return m.pricePerTon; } return 0; })();
                                    const ingTotal = Math.round((ing.pct / 100) * ingCost);
                                    return (
                                      <div key={fi} className="flex items-center gap-1.5 md:gap-2 bg-[#1e2130] rounded-lg px-2.5 md:px-3 py-1.5 border border-white/5 text-[10px] md:text-xs shadow-sm">
                                        <span className="font-semibold text-white/90">{ing.material}</span>
                                        <span className="text-white/50">{ing.pct}%</span>
                                        <span className="w-px h-3 md:h-4 bg-white/10" />
                                        <span className="text-orange-400 font-semibold">{fmtCurrency(ingCost)}{t("/ط", "/T")}</span>
                                        <span className="text-white/40">×</span>
                                        <span className="font-bold text-white">{fmtCurrency(ingTotal)}</span>
                                      </div>
                                    );
                                  })}
                                  <div className="flex items-center gap-1.5 md:gap-2 bg-primary/15 rounded-lg px-2.5 md:px-3 py-1.5 border border-primary/30 text-[10px] md:text-xs font-semibold shadow-sm">
                                    <ArrowUpDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                                    <span className="text-white/70">{t("تكلفة التركيبة", "Formula cost")}:</span> <span className="text-primary text-xs md:text-sm">{fmtCurrency(fc)}</span>
                                  </div>
                                </div>
                              );
                              return magnify ? <MagItem label={t("التركيبة", "Formula")} detail={formula.length + " " + t("مكونات", "ingredients")} big={fmtCurrency(fc)} sub={t("تكلفة", "Cost")} ringColor="hsl(var(--primary))">{content}</MagItem> : content;
                            })()}
                          </td>
                        </motion.tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <motion.tr variants={itemVariants}><td colSpan={priceFields.length + 6} className="p-10 md:p-12 text-center text-muted-foreground text-sm">{t("لا توجد منتجات", "No products found")}</td></motion.tr>
                )}
              </motion.tbody>
            </table>
          </motion.div>

          ) : (
          <motion.div key="cards" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
            {filtered.length === 0 ? (
              <motion.div variants={itemVariants} className="col-span-full">
                <Card className="p-4 sm:p-8 text-center text-muted-foreground text-sm">{t("لا توجد منتجات", "No products found")}</Card>
              </motion.div>
            ) : (
              filtered.map((p, idx) => {
                const stock = getStock(p.productId);
                const costPrice = p.costPrice || 0;
                const margin = costPrice ? Math.round(((p.wholeSalePrice - costPrice) / costPrice) * 100) : 0;
                const isBelowCost = costPrice > 0 && p.wholeSalePrice > 0 && p.wholeSalePrice < costPrice;
                const formula = formulas[p.productId];
                const showFormula = formula && formula.length > 0;
                const isExpanded = expandedFormula === p.productId;
                return (
                  <motion.div key={p.productId} variants={itemVariants}>
                  <MobileProductCard {...{
                    p, stock, margin, isBelowCost, formula, showFormula, isExpanded,
                    onToggleFormula: () => setExpandedFormula(isExpanded ? null : p.productId),
                    onEdit: setEditing,
                    editing, editValue,
                    onEditChange: (e: any) => setEditValue(e.target.value),
                    onSave: saveEdit,
                    onCancel: cancelEdit,
                    onHistory: () => setHistoryProduct(p),
                    onStartEdit: startEdit,
                    costPrice, allPrices: productPrices, magnify,
                  }} />
                  </motion.div>
                );
              })
            )}
          </motion.div>
          )}
          </AnimatePresence>

          {/* ── Mobile cards ── */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="md:hidden space-y-2">
            {filtered.length === 0 ? (
              <motion.div variants={itemVariants}><Card className="p-8 text-center text-muted-foreground text-sm">{t("لا توجد منتجات", "No products found")}</Card></motion.div>
            ) : (
              filtered.map((p, idx) => {
                const stock = getStock(p.productId);
                const costPrice = p.costPrice || 0;
                const margin = costPrice ? Math.round(((p.wholeSalePrice - costPrice) / costPrice) * 100) : 0;
                const isBelowCost = costPrice > 0 && p.wholeSalePrice > 0 && p.wholeSalePrice < costPrice;
                const formula = formulas[p.productId];
                const showFormula = formula && formula.length > 0;
                const isExpanded = expandedFormula === p.productId;
                return (
                  <motion.div key={p.productId} variants={itemVariants}>
                  <MobileProductCard {...{
                    p, stock, margin, isBelowCost, formula, showFormula, isExpanded,
                    onToggleFormula: () => setExpandedFormula(isExpanded ? null : p.productId),
                    onEdit: setEditing,
                    editing, editValue,
                    onEditChange: (e: any) => setEditValue(e.target.value),
                    onSave: saveEdit,
                    onCancel: cancelEdit,
                    onHistory: () => setHistoryProduct(p),
                    onStartEdit: startEdit,
                    costPrice, allPrices: productPrices, magnify,
                  }} />
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </div>
      )}

      {/* ═══ PRICE HISTORY DIALOG ═══ */}
      <Dialog open={!!historyProduct} onOpenChange={v => { if (!v) setHistoryProduct(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
              <History className="w-4 h-4 md:w-5 md:h-5" />
              {t("سجل تغيير الأسعار", "Price History")} — {historyProduct?.productName}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-72 md:max-h-80">
            <div className="space-y-1.5 md:space-y-2">
              {historyProduct?.priceHistory.length === 0 ? (
                <p className="text-xs md:text-sm text-muted-foreground text-center py-6 md:py-8">{t("لا يوجد سجل بعد", "No history yet")}</p>
              ) : historyProduct?.priceHistory.map((entry, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border/20 pb-1.5 md:pb-2 text-xs md:text-sm">
                  <div>
                    <p className="text-muted-foreground">{fmtDate(entry.date)}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {entry.field === "wholeSalePrice" ? t("الجملة", "Wholesale") :
                       entry.field === "retailPrice" ? t("القطاعي", "Retail") :
                       entry.field === "distributorPrice" ? t("الموزع", "Distributor") :
                       entry.field === "costPrice" ? t("التكلفة", "Cost") :
                       entry.field === "minSalePrice" ? t("الحد الأدنى", "Min Sale") : entry.field}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-muted-foreground line-through">{fmtCurrency(entry.oldValue)}</p>
                    <p className="text-primary font-bold text-sm md:text-base">{fmtCurrency(entry.newValue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ═══ AUTO-PRICE DIALOG ═══ */}
      <Dialog open={!!pricingItem} onOpenChange={v => { if (!v) { setPricingItem(null); } }}>
        <DialogContent className="w-[calc(100vw-32px)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
              {t("تسعير", "Price")}: {pricingItem}
            </DialogTitle>
          </DialogHeader>
          {pricingItem && (() => {
            const invItems = inventory.filter(i => i.materialName === pricingItem);
            const firstInv = invItems[0];
            const stock = invItems.reduce((s, i) => s + (i.unit === "ton" ? i.quantity : i.quantity / 1000), 0);
            const autoCode = firstInv ? (firstInv.type === "raw" ? "RAW-" : "FIN-") + pricingItem.replace(/[^\w]/g, "").slice(0, 6).toUpperCase() : "";
            const effectiveCode = piCode || autoCode;
            const formulaKey = Object.entries(formulas).find(([, f]) => f.some(ing => ing.material === pricingItem))?.[0];
            const formula = formulaKey ? formulas[formulaKey] : null;
            const formulaCost = formulaKey ? calculateFormulaCost(formulaKey) : 0;
            const defaultCost = piCost || String(Math.round(
              (useProcurementStore.getState().orders
                .filter(o => ["approved","delivered","paid"].includes(o.status))
                .flatMap(o => o.items.filter(i => i.material === pricingItem).map(i => i.unitPrice))
                .sort((a, b) => b - a)[0] || 0)
            ));
            const defaultWholesale = piWholesale || String(Math.round((Number(defaultCost) || 0) * 1.2));
            const defaultRetail = piRetail || String(Math.round((Number(defaultWholesale) || 0) * 1.08));
            const defaultDistributor = piDistributor || String(Math.round((Number(defaultWholesale) || 0) * 0.95));
            const defaultMinSale = piMinSale || String(Math.round((Number(defaultWholesale) || 0) * 0.9));
            const marginPct = Number(defaultCost) > 0 ? Math.round(((Number(defaultWholesale) - Number(defaultCost)) / Number(defaultCost)) * 100) : 0;
            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div><label className="text-[10px] font-semibold text-muted-foreground">{t("المنتج", "Product")}</label><p className="text-sm font-bold">{pricingItem}</p></div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">{t("كود", "Code")}</label>
                    <Input value={effectiveCode} onChange={e => setPiCode(e.target.value)} className="h-8 text-xs" placeholder={t("كود المنتج", "Product code")} />
                  </div>
                  <div><label className="text-[10px] font-semibold text-muted-foreground">{t("المخزون", "Stock")}</label><p className="text-sm font-bold">{fmtNum(stock)} {t("ط", "T")}</p></div>
                  {formula && <div className="col-span-full"><label className="text-[10px] font-semibold text-muted-foreground">{t("التركيبة", "Formula")}</label><p className="text-xs text-muted-foreground">{formula.map(ing => ing.material).join(" + ")} ({t("تكلفة", "cost")}: {fmtCurrency(formulaCost || 0)})</p></div>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border-t border-border/20 pt-3">
                  {[
                    { key: "التكلفة", en: "Cost", val: defaultCost, set: setPiCost, color: "text-orange-600" },
                    { key: "الجملة", en: "Wholesale", val: defaultWholesale, set: setPiWholesale, color: "text-sky-600" },
                    { key: "القطاعي", en: "Retail", val: defaultRetail, set: setPiRetail, color: "text-emerald-600" },
                    { key: "الموزع", en: "Distributor", val: defaultDistributor, set: setPiDistributor, color: "text-violet-600" },
                    { key: "الحد الأدنى", en: "Min Sale", val: defaultMinSale, set: setPiMinSale, color: "text-rose-600" },
                    { key: "الهامش", en: "Margin", val: `${marginPct}%`, set: null, color: marginPct >= 20 ? "text-emerald-600" : marginPct >= 10 ? "text-amber-600" : "text-red-500" },
                  ].map(f => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">{t(f.key, f.en)}</label>
                      {f.set ? (
                        <Input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                          className={`h-8 text-xs text-center font-bold ${f.color}`} />
                      ) : (
                        <p className={`text-sm font-bold ${f.color}`}>{f.val}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-border/20">
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setPricingItem(null)}>
                    {t("إلغاء", "Cancel")}
                  </Button>
                  <Button size="sm" className="h-9 text-xs gap-1" onClick={() => {
                    const invMatch = inventory.find(i => i.materialName === pricingItem);
                    if (invMatch) {
                      usePricingStore.getState().ensureInventoryPrices([{
                        id: invMatch.id,
                        materialName: invMatch.materialName,
                        type: invMatch.type,
                        unit: invMatch.unit,
                      }]);
                      const product = usePricingStore.getState().productPrices.find(p => p.productName === pricingItem);
                      if (product) {
                        const numericUpdates: [keyof ProductPrice, number][] = [];
                        const costVal = Number(piCost || defaultCost);
                        const wholesaleVal = Number(piWholesale || defaultWholesale);
                        const retailVal = Number(piRetail || defaultRetail);
                        const distributorVal = Number(piDistributor || defaultDistributor);
                        const minSaleVal = Number(piMinSale || defaultMinSale);
                        if (costVal) numericUpdates.push(["costPrice", costVal]);
                        if (wholesaleVal) numericUpdates.push(["wholeSalePrice", wholesaleVal]);
                        if (retailVal) numericUpdates.push(["retailPrice", retailVal]);
                        if (distributorVal) numericUpdates.push(["distributorPrice", distributorVal]);
                        if (minSaleVal) numericUpdates.push(["minSalePrice", minSaleVal]);
                        numericUpdates.forEach(([field, value]) => {
                          usePricingStore.getState().updatePrice(product.productId, field, value);
                        });
                      }
                    }
                    setPricingItem(null);
                  }}>
                    <Save className="w-3.5 h-3.5" /> {t("حفظ التسعير", "Save Pricing")}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══ REPORT DIALOG ═══ */}
      <Dialog open={repOpen} onOpenChange={v => { if (!v) { setRepOpen(false); setRepGenerated(false); } }}>
        <DialogContent className="w-[calc(100vw-32px)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
              {t("تقرير التسعير", "Pricing Report")}
            </DialogTitle>
          </DialogHeader>
          {!repGenerated ? (
            <div className="space-y-4 py-2">
              {/* Date mode */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">{t("نطاق التاريخ", "Date Range")}</label>
                <div className="flex gap-2 flex-wrap">
                  {(["all", "today", "range"] as DateMode[]).map(mode => (
                    <button key={mode} onClick={() => setRepDateMode(mode)}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all border ${
                        repDateMode === mode
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/50 text-muted-foreground border-border/40 hover:border-primary/30"
                      }`}>
                      {mode === "all" ? t("كل الفترة", "All") : mode === "today" ? t("اليوم", "Today") : t("نطاق", "Range")}
                    </button>
                  ))}
                </div>
                {repDateMode === "range" && (
                  <div className="flex gap-2 items-center">
                    <Input type="date" value={repDateFrom} onChange={e => setRepDateFrom(e.target.value)}
                      className="h-9 text-xs" />
                    <span className="text-xs text-muted-foreground">{t("إلى", "to")}</span>
                    <Input type="date" value={repDateTo} onChange={e => setRepDateTo(e.target.value)}
                      className="h-9 text-xs" />
                  </div>
                )}
              </div>
              {/* Sections to include */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">{t("الأقسام", "Sections")}</label>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { key: "repPriceList" as const, label: t("قائمة الأسعار", "Price List") },
                    { key: "repAlerts" as const, label: t("التنبيهات", "Alerts") },
                    { key: "repMargins" as const, label: t("الهوامش", "Margins") },
                  ].map(s => (
                    <label key={s.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={
                        s.key === "repPriceList" ? repPriceList : s.key === "repAlerts" ? repAlerts : repMargins
                      } onChange={() => {
                        if (s.key === "repPriceList") setRepPriceList(!repPriceList);
                        else if (s.key === "repAlerts") setRepAlerts(!repAlerts);
                        else setRepMargins(!repMargins);
                      }} className="rounded border-border" />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              {repPriceList && (
                <div className="space-y-2 pt-1 border-t border-border/20">
                  <label className="text-xs font-semibold text-muted-foreground">{t("أعمدة الجدول", "Table Columns")}</label>
                  <div className="flex gap-2 flex-wrap">
                    {ALL_COL_KEYS.map(k => {
                      const colLabel: Record<string, string> = { productName: "المنتج", productCode: "الكود", costPrice: "التكلفة", wholeSalePrice: "الجملة", retailPrice: "القطاعي", distributorPrice: "الموزع", minSalePrice: "الحد الأدنى", margin: "الهامش" };
                      return (
                        <label key={k} className="flex items-center gap-1 text-[10px] cursor-pointer">
                          <input type="checkbox" checked={visibleCols.includes(k)} onChange={() => {
                            setVisibleCols(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k]);
                          }} className="rounded border-border w-3 h-3" />
                          {t(colLabel[k], k)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Generate */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => setRepOpen(false)}>
                  <X className="w-3.5 h-3.5" /> {t("إلغاء", "Cancel")}
                </Button>
                <Button size="sm" className="h-9 text-xs gap-1" onClick={handleGenerateReport} disabled={repGenerating || (repDateMode === "range" && !repDateFrom && !repDateTo)}>
                  {repGenerating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BarChart3 className="w-3.5 h-3.5" />
                  )}
                  {repGenerating ? t("جارٍ الإنشاء...", "Generating...") : t("إنشاء التقرير", "Generate Report")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
                <BarChart3 className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-semibold">{t("تم إنشاء التقرير", "Report Ready")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("يمكنك الآن معاينة وطباعة التقرير", "You can now preview and print the report")}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => { setRepOpen(false); setRepGenerated(false); }}>
                  <X className="w-3.5 h-3.5" /> {t("إغلاق", "Close")}
                </Button>
                <Button size="sm" className="h-9 text-xs gap-1" onClick={handleDownloadPDF}>
                  <Download className="w-3.5 h-3.5" /> {t("معاينة وطباعة", "Preview & Print")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
