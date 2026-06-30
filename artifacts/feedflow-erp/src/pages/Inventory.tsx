import React, { useState } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useProductionStore, type BagEntry } from "@/hooks/use-production-store";
import { useProcurementStore } from "@/hooks/use-procurement-store";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SmartInput from "@/components/SmartInput";
import { getFeedTermSuggestions } from "@/lib/spellcheck";
import { getUnitLabel, getBaseUnitLabel, convertToBase, getDefaultUnit, getBaseUnit } from "@/lib/product-config";
import { motion, AnimatePresence } from "framer-motion";
import { MagItem } from "@/components/ui/magnifier";
import { Package, PackageCheck, AlertCircle, ArrowRightLeft, Plus, CheckCircle2, Factory, Pencil, Trash2, X, BarChart3, Download } from "lucide-react";
import { fmtDate } from "@/lib/utils";

type DateMode = "all" | "today" | "range";

const containerVariants = { hidden:{ opacity:0 }, show:{ opacity:1, transition:{ staggerChildren:0.08 } } };
const itemVariants      = { hidden:{ opacity:0, y:10 }, show:{ opacity:1, y:0 } };

type TabType = "all" | "raw" | "finished";

export default function Inventory() {
  const { t, productConfig, language }                = useAppStore();
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, warehouseConfigs, addWarehouseConfig } = useProductionStore();
  const warehouses = warehouseConfigs;

  const [addOpen,      setAddOpen]      = useState(false);
  const [editOpen,     setEditOpen]     = useState(false);
  const [editItemId,   setEditItemId]   = useState<string|null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [editDone,     setEditDone]     = useState(false);
  const [transferDone, setTransferDone] = useState(false);
  const [activeTab,    setActiveTab]    = useState<TabType>("all");
  const [whAddOpen, setWhAddOpen] = useState(false);
  const [whNewName, setWhNewName] = useState("");
  const [editMode,     setEditMode]     = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string|null>(null);
  const [linkedPoAlert, setLinkedPoAlert] = useState<{name:string; count:number} | null>(null);

  // Add form
  const [newMaterial,  setNewMaterial]  = useState("");
  const [newQty,       setNewQty]       = useState("");
  const [newUnit,      setNewUnit]      = useState<string>(getDefaultUnit(productConfig));
  const [newWarehouse, setNewWarehouse] = useState("");
  const [newExpiry,    setNewExpiry]    = useState("");
  const [newType,      setNewType]      = useState<"raw"|"finished">("raw");

  // Edit form
  const [editMaterial,  setEditMaterial]  = useState("");
  const [editQty,       setEditQty]       = useState("");
  const [editUnit,      setEditUnit]      = useState<string>(getDefaultUnit(productConfig));
  const [editWarehouse, setEditWarehouse] = useState("");
  const [editExpiry,    setEditExpiry]    = useState("");
  const [editType,      setEditType]      = useState<"raw"|"finished">("raw");

  const openEdit = (item: typeof inventory[number]) => {
    setEditItemId(item.id);
    setEditMaterial(item.materialName);
    setEditQty(String(item.quantity));
    setEditUnit(item.unit);
    setEditWarehouse(item.warehouseId);
    setEditExpiry(item.expiryDate);
    setEditType(item.type);
    setBagRows([]);
    setEditOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const { orders } = useProcurementStore.getState();
    const linked = orders.filter(o =>
      o.items?.some(oi => oi.material === item.materialName)
    );
    if (linked.length > 0) {
      setLinkedPoAlert({ name: item.materialName, count: linked.length });
      return;
    }
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (!deleteConfirmId) return;
    deleteInventoryItem(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleEditSubmit = () => {
    if (!editItemId || !editMaterial || !editQty || !editWarehouse) return;
    const newQty = parseFloat(editQty);
    const item = inventory.find(i => i.id === editItemId);
    const whCfg = warehouseConfigs.find(w => w.id === editWarehouse);
    const normalTh = whCfg?.normalThreshold ?? 50;
    const warnTh = whCfg?.warningThreshold ?? 20;
    const newAlertLevel = newQty > 0
      ? (() => {
          const pct = (newQty / Math.max(newQty, item?.initialQuantity || newQty)) * 100;
          if (pct < warnTh) return "critical";
          if (pct < normalTh) return "warning";
          return "normal";
        })()
      : "critical";
    updateInventoryItem(editItemId, {
      materialName: editMaterial,
      quantity:     newQty,
      unit:         editUnit,
      warehouseId:  editWarehouse,
      expiryDate:   editExpiry || new Date(Date.now() + 180*86400000).toISOString().slice(0,10),
      type:         editType,
      alertLevel:   newAlertLevel,
    });
    setEditDone(true);
    setTimeout(()=>{
      setEditDone(false); setEditOpen(false); setEditItemId(null);
    }, 1400);
  };

  // Bag size config (shared for add & edit) — same style as Production
  const [bagRows, setBagRows] = useState<BagEntry[]>([]);
  const PRESET_WEIGHTS=productConfig.packageWeightPresets;
  const addPresetBag=(kg:number)=>{if(bagRows.find(b=>b.weightKg===kg))return;setBagRows([...bagRows,{id:Date.now().toString(),weightKg:kg,count:0}]);};
  const addCustomBag=()=>setBagRows([...bagRows,{id:Date.now().toString(),weightKg:0,count:0}]);
  const updBag=(id:string,field:"weightKg"|"count",val:number)=>setBagRows(bagRows.map(b=>b.id===id?{...b,[field]:Math.max(0,val)}:b));
  const remBag=(id:string)=>setBagRows(bagRows.filter(b=>b.id!==id));
  const bagTotal = ()=>bagRows.reduce((s,b)=>s+b.count,0);
  const bagTons  = ()=>bagRows.reduce((s,b)=>s+(b.count*b.weightKg)/1000,0);

  // Transfer form
  const [transferItem,    setTransferItem]    = useState("");
  const [toWarehouse,     setToWarehouse]     = useState("");
  const [transferQty,     setTransferQty]     = useState("");
  const [transferUnit,    setTransferUnit]    = useState<string>(getDefaultUnit(productConfig));

  // Report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDateMode, setReportDateMode] = useState<DateMode>("all");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportSummary, setReportSummary] = useState(true);
  const [reportAlerts, setReportAlerts] = useState(true);
  const [reportListing, setReportListing] = useState(true);
  const [reportType, setReportType] = useState<"all"|"raw"|"finished">("all");

  const displayItems = inventory.filter(i => activeTab === "all" ? true : i.type === activeTab);
  const materialNames = [...new Set(inventory.map(i => i.materialName))];

  const handleAddSubmit = () => {
    if (!newMaterial || !newQty || !newWarehouse) return;
    const qty = parseFloat(newQty);
    const whCfg = warehouseConfigs.find(w => w.id === newWarehouse);
    const normalTh = whCfg?.normalThreshold ?? 50;
    const warnTh = whCfg?.warningThreshold ?? 20;
    const alertLvl = qty > 0
      ? (warnTh <= 0 ? "critical" : normalTh <= 0 ? "warning" : "normal")
      : "critical";
    addInventoryItem({
      id: `I${Date.now()}`,
      materialName:   newMaterial,
      quantity:       qty,
      initialQuantity: qty,
      consumedQuantity: 0,
      unit:           newUnit,
      warehouseId:    newWarehouse,
      batchNumber:    `B-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`,
      productionDate: new Date().toISOString().split("T")[0],
      expiryDate:     newExpiry || new Date(Date.now() + 180*86400000).toISOString().slice(0,10),
      alertLevel:     alertLvl,
      type:           newType,
    });
    setSubmitted(true);
    setTimeout(()=>{
      setSubmitted(false); setAddOpen(false);
      setNewMaterial(""); setNewQty(""); setNewUnit("ton"); setNewWarehouse(""); setNewExpiry(""); setNewType("raw");
      setBagRows([]);
    }, 1400);
  };

  const handleTransferSubmit = () => {
    if (!transferItem || !toWarehouse || !transferQty) return;
    const qty = parseFloat(transferQty);
    if (qty <= 0) return;
    const sourceItem = inventory.find(i => i.materialName === transferItem);
    if (!sourceItem || sourceItem.warehouseId === toWarehouse) return;
    // Deduct from source
    const newSrcQty = Math.max(0, +(sourceItem.quantity - qty).toFixed(3));
    const srcWhCfg = warehouseConfigs.find(w => w.id === sourceItem.warehouseId);
    const srcNormal = srcWhCfg?.normalThreshold ?? 50;
    const srcWarn = srcWhCfg?.warningThreshold ?? 20;
    const srcPct = sourceItem.initialQuantity > 0 ? (newSrcQty / sourceItem.initialQuantity) * 100 : 100;
    const srcAlert = newSrcQty <= 0 ? "critical" : srcPct < srcWarn ? "critical" : srcPct < srcNormal ? "warning" : "normal";
    updateInventoryItem(sourceItem.id, { quantity: newSrcQty, alertLevel: srcAlert });
    // Add to destination
    const existingDest = inventory.find(i => i.materialName === sourceItem.materialName && i.batchNumber === sourceItem.batchNumber && i.warehouseId === toWarehouse);
    if (existingDest) {
      const newDestQty = +(existingDest.quantity + qty).toFixed(3);
      const destWhCfg = warehouseConfigs.find(w => w.id === toWarehouse);
      const dNormal = destWhCfg?.normalThreshold ?? 50;
      const dWarn = destWhCfg?.warningThreshold ?? 20;
      const dPct = existingDest.initialQuantity > 0 ? (newDestQty / existingDest.initialQuantity) * 100 : 100;
      const dAlert = dPct < dWarn ? "critical" : dPct < dNormal ? "warning" : "normal";
      updateInventoryItem(existingDest.id, { quantity: newDestQty, alertLevel: dAlert });
    } else {
      const dWhCfg = warehouseConfigs.find(w => w.id === toWarehouse);
      const dNormal = dWhCfg?.normalThreshold ?? 50;
      const dWarn = dWhCfg?.warningThreshold ?? 20;
      const dAlert = qty <= 0 ? "critical" : dWarn <= 0 ? "critical" : dNormal <= 0 ? "warning" : "normal";
      addInventoryItem({
        id: `TRF-${Date.now()}`,
        materialName: sourceItem.materialName,
        quantity: qty,
        initialQuantity: qty,
        consumedQuantity: 0,
        unit: transferUnit,
        warehouseId: toWarehouse,
        batchNumber: sourceItem.batchNumber,
        productionDate: sourceItem.productionDate,
        expiryDate: sourceItem.expiryDate,
        alertLevel: dAlert,
        type: sourceItem.type,
      });
    }
    setTransferDone(true);
    setTimeout(()=>{ setTransferDone(false); setTransferOpen(false); setTransferItem(""); setToWarehouse(""); setTransferQty(""); setTransferUnit("ton"); }, 1400);
  };

  const alertColor = (level:string) => {
    if (level === "critical") return "bg-destructive/10 text-destructive border-destructive/20";
    if (level === "warning")  return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  };
  const alertText = (level:string) => {
    if (level === "critical") return t("حرج","Critical");
    if (level === "warning")  return t("تحذير","Warning");
    return t("طبيعي","Normal");
  };

  const rawCount      = inventory.filter(i => i.type === "raw").length;
  const finishedCount = inventory.filter(i => i.type === "finished").length;
  const warnCount     = inventory.filter(i => i.alertLevel === "warning").length;
  const critCount     = inventory.filter(i => i.alertLevel === "critical").length;

  // KPI hover details
  const rawTons = inventory.filter(i=>i.type==="raw").reduce((s,i)=>s+(convertToBase(productConfig, i.quantity, i.unit)),0);
  const finTons = inventory.filter(i=>i.type==="finished").reduce((s,i)=>s+(convertToBase(productConfig, i.quantity, i.unit)),0);
  const alertItems = inventory.filter(i=>i.alertLevel!=="normal");

  // ── Inventory Report ──
  const handleGenerateInventoryReport = () => {
    if (reportDateMode === "range" && !reportDateFrom && !reportDateTo) return;
    setReportGenerating(true);
    setTimeout(() => { setReportGenerating(false); setReportGenerated(true); }, 1200);
  };
  const handleDownloadInventoryPDF = () => {
    const reportItems = inventory.filter(i => {
      if (reportType !== "all" && i.type !== reportType) return false;
      return true;
    });
    const rptTotalItems = reportItems.length;
    const rptRaw = reportItems.filter(i => i.type === "raw").reduce((s, i) => s + (convertToBase(productConfig, i.quantity, i.unit)), 0);
    const rptFinished = reportItems.filter(i => i.type === "finished").reduce((s, i) => s + (convertToBase(productConfig, i.quantity, i.unit)), 0);
    const rptCrit = reportItems.filter(i => i.alertLevel === "critical");
    const rptWarn = reportItems.filter(i => i.alertLevel === "warning");
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const formatter = new Intl.NumberFormat("ar-EG");

    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = reportDateMode === "all" ? t("كل المخزون", "All Inventory") : reportDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${reportDateFrom || "..."} ${t("إلى", "to")} ${reportDateTo || "..."}`;
    const typeLabel = reportType === "all" ? t("جميع الأصناف", "All Items") : reportType === "raw" ? t("الخامات", "Raw Materials") : t("المنتجات", "Finished Products");

    const styles = `
      @page{size:A4;margin:15mm 18mm}
      body{font-family:'Segoe UI',Tahoma,sans-serif;direction:rtl;color:#1e293b;line-height:1.7;font-size:12px}
      .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:120px;font-weight:900;color:rgba(37,99,235,.04);pointer-events:none;z-index:-1;letter-spacing:8px;white-space:nowrap}
      .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:22px;gap:20px}
      .header-right{text-align:right}
      .header-left{text-align:left;color:#64748b;font-size:11px;line-height:1.5}
      .header h1{font-size:20px;margin:0 0 2px;color:#1d4ed8;font-weight:800}
      .header .sub{font-size:12px;color:#64748b;margin:0}
      .header .company{font-size:13px;font-weight:700;color:#1e293b}
      .meta{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:20px;padding:8px 12px;background:#f8fafc;border-radius:6px}
      .section{margin-bottom:20px}
      .section h2{font-size:14px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:0 0 10px;color:#1d4ed8;font-weight:700;display:flex;align-items:center;gap:6px}
      .section h2:before{content:'';display:inline-block;width:4px;height:16px;background:#1d4ed8;border-radius:2px}
      .section p{font-size:12px;margin:4px 0}
      .grid{display:flex;gap:8px;flex-wrap:wrap}
      .card{flex:1;min-width:90px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 8px;text-align:center;background:#fff}
      .card .num{font-size:18px;font-weight:800}
      .card .lbl{font-size:10px;color:#64748b;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11px;border-radius:6px;overflow:hidden}
      th{background:#1d4ed8;color:#fff;font-weight:600;padding:7px 6px;font-size:11px}
      td{border:1px solid #e2e8f0;padding:6px}
      tr:nth-child(even){background:#f8fafc}
      tr:hover{background:#eef2ff}
      .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:500}
      .badge-green{background:#dcfce7;color:#15803d}
      .badge-blue{background:#dbeafe;color:#1d4ed8}
      .badge-red{background:#fee2e2;color:#dc2626}
      .badge-amber{background:#fef3c7;color:#b45309}
      .badge-default{background:#f1f5f9;color:#475569}
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
      .summary-row{display:flex;gap:10px;margin-bottom:4px}
      .summary-row p{flex:1;margin:0}
    `;

    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right">
          <h1>${t("تقرير المخزون", "Inventory Report")}</h1>
          <p class="sub">${periodLabel} · ${typeLabel}</p>
        </div>
        <div class="header-left">
          ${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}
          <div class="company">${companyName || "تاج"}</div>
          ${companyAddress ? `<div>${companyAddress}</div>` : ""}
          <div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div>
        </div>
      </div>
      <div class="meta">
        <span>📦 ${rptTotalItems} ${t("صنف", "item(s)")}</span>
        <span>🏭 ${t("قسم المخزون", "Inventory Department")}</span>
      </div>
      ${reportSummary ? `
      <div class="section">
        <h2>${t("ملخص المخزون", "Inventory Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num" style="color:#1d4ed8">${rptTotalItems}</div><div class="lbl">${t("إجمالي الأصناف", "Total Items")}</div></div>
          <div class="card"><div class="num" style="color:#1d4ed8">${rptRaw.toFixed(1)}<span style="font-size:12px;font-weight:400">/${rptFinished.toFixed(1)}</span></div><div class="lbl">${t("خام/منتج (ط)", "Raw/Fin (T)")}</div></div>
          <div class="card"><div class="num" style="color:#1d4ed8">${rptCrit.length + rptWarn.length}</div><div class="lbl">${t("تنبيهات", "Alerts")}</div></div>
        </div>
      </div>` : ""}
      ${reportAlerts && (rptCrit.length > 0 || rptWarn.length > 0) ? `
      <div class="section">
        <h2>${t("المواد الحرجة والتحذيرات", "Critical & Warning Items")}</h2>
        ${rptCrit.length > 0 ? `
        <table>
          <tr><th>${t("المادة", "Material")}</th><th>${t("المستودع", "Warehouse")}</th><th>${t("الكمية", "Qty")}</th><th>${t("الحالة", "Status")}</th></tr>
          ${rptCrit.map(i => {
            const wh = warehouses.find(w => w.id === i.warehouseId);
            return `<tr><td><strong>${i.materialName}</strong></td><td>${wh?.name || i.warehouseId}</td><td>${i.quantity} ${getUnitLabel(productConfig, i.unit, language)}</td><td><span class="badge badge-red">${t("حرج", "Critical")}</span></td></tr>`;
          }).join("")}
        </table>` : ""}
        ${rptWarn.length > 0 ? `
        <table>
          <tr><th>${t("المادة", "Material")}</th><th>${t("المستودع", "Warehouse")}</th><th>${t("الكمية", "Qty")}</th><th>${t("الحالة", "Status")}</th></tr>
          ${rptWarn.map(i => {
            const wh = warehouses.find(w => w.id === i.warehouseId);
            return `<tr><td>${i.materialName}</td><td>${wh?.name || i.warehouseId}</td><td>${i.quantity} ${getUnitLabel(productConfig, i.unit, language)}</td><td><span class="badge badge-amber">${t("تحذير", "Warning")}</span></td></tr>`;
          }).join("")}
        </table>` : ""}
      </div>` : ""}
      ${reportListing && reportItems.length > 0 ? `
      <div class="section">
        <h2>${t("كشف الجرد", "Inventory Listing")} (${rptTotalItems})</h2>
        <table>
          <tr><th>${t("المادة", "Material")}</th><th>${t("النوع", "Type")}</th><th>${t("المستودع", "Warehouse")}</th><th>${t("الكمية", "Qty")}</th><th>${t("التشغيلة", "Batch")}</th><th>${t("الصلاحية", "Expiry")}</th><th>${t("الحالة", "Status")}</th></tr>
          ${reportItems.map(i => {
            const wh = warehouses.find(w => w.id === i.warehouseId);
            const st = i.alertLevel === "critical" ? `<span class="badge badge-red">${t("حرج", "Critical")}</span>` : i.alertLevel === "warning" ? `<span class="badge badge-amber">${t("تحذير", "Warning")}</span>` : `<span class="badge badge-green">${t("طبيعي", "Normal")}</span>`;
            const tp = i.type === "raw" ? t("خام", "Raw") : t("منتج", "Finished");
            return `<tr><td style="font-weight:600">${i.materialName}</td><td>${tp}</td><td>${wh?.name || i.warehouseId}</td><td>${i.quantity} ${getUnitLabel(productConfig, i.unit, language)}</td><td>${i.batchNumber}</td><td>${fmtDate(i.expiryDate)}</td><td>${st}</td></tr>`;
          }).join("")}
        </table>
      </div>` : ""}
      <div class="footer">
        <p><span class="footer-logo">${companyName || "تاج"}</span> — ${t("جميع الحقوق محفوظة", "All rights reserved")} © ${new Date().getFullYear()}</p>
        <p style="margin-top:2px">${t("تم إنشاؤه بواسطة", "Generated by")} تاج — ${nowStr}</p>
      </div>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("المخزون","Inventory")}</h1>
          <p className="text-muted-foreground mt-1">{t("خامات ومنتجات نهائية — تتحدث تلقائياً مع الإنتاج","Raw materials & finished products — auto-synced with production")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={editMode?"default":"outline"} className="gap-2 w-full sm:w-auto" onClick={()=>setEditMode(v=>!v)}>
            <Pencil className="w-4 h-4"/>{editMode?t("إنهاء التعديل","Done Editing"):t("تعديل","Edit")}
          </Button>
          <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={()=>setTransferOpen(true)} data-testid="button-transfer-inventory">
            <ArrowRightLeft className="w-4 h-4"/>{t("نقل","Transfer")}
          </Button>
          <Button className="gap-2 w-full sm:w-auto" onClick={()=>setAddOpen(true)} data-testid="button-add-inventory-item">
            <Plus className="w-4 h-4"/>{t("إضافة صنف","Add Item")}
          </Button>
          <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={()=>setReportOpen(true)}>
            <BarChart3 className="w-4 h-4"/>{t("تقارير","Reports")}
          </Button>
        </div>
      </div>

      {/* KPI cards with hover details */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <HoverCard openDelay={0} closeDelay={150}>
          <HoverCardTrigger asChild>
            <Card className="p-4 flex items-center gap-3 border-s-4 border-s-primary cursor-pointer hover:shadow-md transition-shadow">
              <div className="p-2.5 bg-primary/10 rounded-full text-primary"><Package className="w-5 h-5"/></div>
              <div><p className="text-2xl font-bold">{inventory.length}</p><p className="text-xs text-muted-foreground">{t("إجمالي الأصناف","Total Items")}</p></div>
            </Card>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" align="start" className="p-0 rounded-2xl border-0 shadow-2xl overflow-hidden backdrop-blur-xl bg-card/95" style={{width:"var(--radix-hover-card-trigger-width)",boxShadow:"0 25px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset"}}>
            <div className="relative overflow-hidden px-4 py-3.5 bg-gradient-to-br from-primary/25 via-primary/10 to-background">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent pointer-events-none"/>
              <div className="absolute -top-6 -end-6 w-20 h-20 rounded-full bg-primary/10 blur-2xl pointer-events-none"/>
              <div className="flex items-center justify-between relative">
                <span className="text-xs font-bold text-primary">{t("توزيع الأصناف","Distribution")}</span>
                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:300,damping:15,delay:0.05}} className="text-end">
                  <p className="text-lg font-black text-primary leading-none">{inventory.length}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{t("صنف","item")}</p>
                </motion.div>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {[
                {label:t("خامات","Raw"),count:rawCount,tons:rawTons,icon:<Package className="w-3.5 h-3.5"/>,hue:"220",color:"blue"},
                {label:t("منتجات","Finished"),count:finishedCount,tons:finTons,icon:<Factory className="w-3.5 h-3.5"/>,hue:"160",color:"emerald"},
              ].map((item,i)=>{
                const pct=inventory.length>0?(item.count/inventory.length)*100:0;
                return(
                  <motion.div key={item.label} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{duration:0.25,delay:i*0.08,ease:"easeOut"}}
                    className="group relative overflow-hidden rounded-xl border border-border/40 hover:border-border/80 transition-all duration-300"
                    style={{background:`linear-gradient(135deg, hsl(${item.hue},60%,60%,0.06) 0%, transparent 100%)`}}>
                    <div className="relative px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur-sm transition-transform group-hover:scale-110"
                            style={{background:`hsl(${item.hue},60%,50%,0.12)`,color:`hsl(${item.hue},70%,50%)`}}>{item.icon}</div>
                          <div><p className="text-sm font-bold leading-tight">{item.label}</p></div>
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-black leading-tight" style={{color:`hsl(${item.hue},70%,50%)`}}>{item.count}</p>
                          <p className="text-[10px] text-muted-foreground font-mono leading-tight">{item.tons.toFixed(1)}{getBaseUnitLabel(productConfig, language)}</p>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.6,delay:0.12+i*0.08,ease:"easeOut"}}
                          className="h-full rounded-full" style={{background:`linear-gradient(90deg, hsl(${item.hue},60%,50%,0.5), hsl(${item.hue},70%,55%))`}}/>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.25}} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10 text-xs font-semibold">
                <span className="text-muted-foreground">{t("الإجمالي","Total")}</span>
                <span>{inventory.length} {t("صنف","items")} · {(rawTons+finTons).toFixed(1)}{getBaseUnitLabel(productConfig, language)}</span>
              </motion.div>
            </div>
          </HoverCardContent>
        </HoverCard>

        <HoverCard openDelay={0} closeDelay={150}>
          <HoverCardTrigger asChild>
            <Card className="p-4 flex items-center gap-3 border-s-4 border-s-blue-500 cursor-pointer hover:shadow-md transition-shadow">
              <div className="p-2.5 bg-blue-500/10 rounded-full text-blue-500"><Package className="w-5 h-5"/></div>
              <div><p className="text-2xl font-bold">{rawCount}</p><p className="text-xs text-muted-foreground">{t("خامات","Raw Materials")}</p></div>
            </Card>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" align="start" className="p-0 rounded-2xl border-0 shadow-2xl overflow-hidden backdrop-blur-xl bg-card/95" style={{width:"var(--radix-hover-card-trigger-width)",boxShadow:"0 25px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset"}}>
            <div className="relative overflow-hidden px-4 py-3.5 bg-gradient-to-br from-blue-500/25 via-blue-500/10 to-background">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none"/>
              <div className="absolute -top-6 -end-6 w-20 h-20 rounded-full bg-blue-500/10 blur-2xl pointer-events-none"/>
              <div className="flex items-center justify-between relative">
                <div><p className="text-xs font-bold text-blue-500">{t("تفاصيل الخامات","Raw Materials")}</p><p className="text-[10px] text-muted-foreground">{t("الكميات بالطن","Quantities in tons")}</p></div>
                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:300,damping:15,delay:0.05}} className="text-end">
                  <p className="text-lg font-black text-blue-500 leading-none">{rawTons.toFixed(0)}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{getBaseUnitLabel(productConfig, language)}</p>
                </motion.div>
              </div>
            </div>
            <div className="p-2 space-y-1.5 max-h-60 overflow-y-auto">
              {inventory.filter(i=>i.type==="raw").map((i,idx)=>{
                const tons=convertToBase(productConfig, i.quantity, i.unit);
                const pct=rawTons>0?(tons/rawTons)*100:0;
                const wh=warehouses.find(w=>w.id===i.warehouseId);
                const isCritical=i.alertLevel==="critical";
                const isWarn=i.alertLevel==="warning";
                return(
                  <motion.div key={i.id} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{duration:0.2,delay:idx*0.04,ease:"easeOut"}}
                    className="relative overflow-hidden rounded-xl border bg-background/40"
                    style={{borderColor:isCritical?"hsl(0,70%,40%,0.25)":isWarn?"hsl(40,90%,50%,0.25)":"hsl(220,60%,50%,0.15)"}}>
                    <div className="relative px-2.5 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate max-w-[130px]">{i.materialName}</span>
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${isCritical?"border-destructive/30 text-destructive":isWarn?"border-amber-500/30 text-amber-500":"border-blue-500/30 text-blue-500"}`}>
                          <MagItem label={t("خامة","Raw")} detail={t("النوع","Type")} big={t("خامة","Raw")} sub="" className="inline-flex" ringColor={isCritical?"hsl(0,70%,55%)":isWarn?"hsl(40,90%,55%)":"hsl(220,70%,50%)"}>{t("خامة","Raw")}</MagItem>
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono font-bold">
                          <MagItem label={`${tons.toFixed(1)} ${getBaseUnitLabel(productConfig, language)}`} detail={t("الرصيد","Stock")} big={tons.toFixed(1)} sub={getBaseUnitLabel(productConfig, language)} className="inline-flex" ringColor={isCritical?"hsl(0,70%,55%)":isWarn?"hsl(40,90%,55%)":"hsl(220,70%,50%)"}>{tons.toFixed(1)} {getBaseUnitLabel(productConfig, language)}</MagItem>
                        </span>
                        <span className="text-muted-foreground font-mono">
                          <MagItem label={i.batchNumber} detail={t("رقم التشغيلة","Batch #")} big={i.batchNumber} sub="" className="inline-flex">{i.batchNumber}</MagItem>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>
                          <MagItem label={wh?.name||i.warehouseId} detail={t("المستودع","Warehouse")} big={wh?.name||i.warehouseId} sub="" className="inline-flex" ringColor="hsl(var(--muted-foreground))">{wh?.name||i.warehouseId}</MagItem>
                        </span>
                        <span>
                          <MagItem label={`${fmtDate(i.productionDate)} → ${fmtDate(i.expiryDate)}`} detail={t("تاريخ الإنتاج→الصلاحية","Prod→Expiry")} big={fmtDate(i.productionDate)} sub={fmtDate(i.expiryDate)} className="inline-flex" ringColor="hsl(var(--muted-foreground))">{fmtDate(i.productionDate)} → {fmtDate(i.expiryDate)}</MagItem>
                        </span>
                      </div>
                      <div className="w-full h-0.5 rounded-full bg-muted/30 overflow-hidden">
                        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.5,delay:0.1+idx*0.03,ease:"easeOut"}}
                          className="h-full rounded-full" style={{background:isCritical?"linear-gradient(90deg, hsl(0,70%,50%,0.4), hsl(0,70%,55%))":isWarn?"linear-gradient(90deg, hsl(40,90%,50%,0.4), hsl(40,90%,55%))":"linear-gradient(90deg, hsl(220,60%,50%,0.4), hsl(220,70%,55%))"}}/>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}} className="mx-2 mb-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500/5 via-blue-500/10 to-blue-500/5 border border-blue-500/10 flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">{t("الإجمالي","Total")}</span>
              <span className="text-blue-500">{rawTons.toFixed(1)}{getBaseUnitLabel(productConfig, language)}</span>
            </motion.div>
          </HoverCardContent>
        </HoverCard>

        <HoverCard openDelay={0} closeDelay={150}>
          <HoverCardTrigger asChild>
            <Card className="p-4 flex items-center gap-3 border-s-4 border-s-emerald-500 cursor-pointer hover:shadow-md transition-shadow">
              <div className="p-2.5 bg-emerald-500/10 rounded-full text-emerald-500"><Factory className="w-5 h-5"/></div>
              <div><p className="text-2xl font-bold">{finishedCount}</p><p className="text-xs text-muted-foreground">{t("منتجات نهائية","Finished Products")}</p></div>
            </Card>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" align="start" className="p-0 rounded-2xl border-0 shadow-2xl overflow-hidden backdrop-blur-xl bg-card/95" style={{width:"var(--radix-hover-card-trigger-width)",boxShadow:"0 25px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset"}}>
            <div className="relative overflow-hidden px-4 py-3.5 bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-background">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent pointer-events-none"/>
              <div className="absolute -top-6 -end-6 w-20 h-20 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none"/>
              <div className="flex items-center justify-between relative">
                <div><p className="text-xs font-bold text-emerald-500">{t("تفاصيل المنتجات","Products")}</p><p className="text-[10px] text-muted-foreground">{t("الكميات بالطن","Quantities in tons")}</p></div>
                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:300,damping:15,delay:0.05}} className="text-end">
                  <p className="text-lg font-black text-emerald-500 leading-none">{finTons.toFixed(0)}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{getBaseUnitLabel(productConfig, language)}</p>
                </motion.div>
              </div>
            </div>
            <div className="p-2 space-y-1.5 max-h-60 overflow-y-auto">
              {inventory.filter(i=>i.type==="finished").map((i,idx)=>{
                const tons=convertToBase(productConfig, i.quantity, i.unit);
                const pct=finTons>0?(tons/finTons)*100:0;
                const wh=warehouses.find(w=>w.id===i.warehouseId);
                const isCritical=i.alertLevel==="critical";
                const isWarn=i.alertLevel==="warning";
                return(
                  <motion.div key={i.id} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{duration:0.2,delay:idx*0.04,ease:"easeOut"}}
                    className="relative overflow-hidden rounded-xl border bg-background/40"
                    style={{borderColor:isCritical?"hsl(0,70%,40%,0.25)":isWarn?"hsl(40,90%,50%,0.25)":"hsl(160,60%,50%,0.2)"}}>
                    <div className="relative px-2.5 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate max-w-[130px]">{i.materialName}</span>
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${isCritical?"border-destructive/30 text-destructive":isWarn?"border-amber-500/30 text-amber-500":"border-emerald-500/30 text-emerald-500"}`}>
                          <MagItem label={t("منتج","Prod")} detail={t("النوع","Type")} big={t("منتج","Prod")} sub="" className="inline-flex" ringColor={isCritical?"hsl(0,70%,55%)":isWarn?"hsl(40,90%,55%)":"hsl(160,60%,50%)"}>{t("منتج","Prod")}</MagItem>
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono font-bold">
                          <MagItem label={`${tons.toFixed(1)} ${getBaseUnitLabel(productConfig, language)}`} detail={t("الرصيد","Stock")} big={tons.toFixed(1)} sub={getBaseUnitLabel(productConfig, language)} className="inline-flex" ringColor={isCritical?"hsl(0,70%,55%)":isWarn?"hsl(40,90%,55%)":"hsl(160,60%,50%)"}>{tons.toFixed(1)} {getBaseUnitLabel(productConfig, language)}</MagItem>
                        </span>
                        <span className="text-muted-foreground font-mono">
                          <MagItem label={i.batchNumber} detail={t("رقم التشغيلة","Batch #")} big={i.batchNumber} sub="" className="inline-flex">{i.batchNumber}</MagItem>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>
                          <MagItem label={wh?.name||i.warehouseId} detail={t("المستودع","Warehouse")} big={wh?.name||i.warehouseId} sub="" className="inline-flex" ringColor="hsl(var(--muted-foreground))">{wh?.name||i.warehouseId}</MagItem>
                        </span>
                        <span>
                          <MagItem label={`${fmtDate(i.productionDate)} → ${fmtDate(i.expiryDate)}`} detail={t("تاريخ الإنتاج→الصلاحية","Prod→Expiry")} big={fmtDate(i.productionDate)} sub={fmtDate(i.expiryDate)} className="inline-flex" ringColor="hsl(var(--muted-foreground))">{fmtDate(i.productionDate)} → {fmtDate(i.expiryDate)}</MagItem>
                        </span>
                      </div>
                      <div className="w-full h-0.5 rounded-full bg-muted/30 overflow-hidden">
                        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.5,delay:0.1+idx*0.03,ease:"easeOut"}}
                          className="h-full rounded-full" style={{background:isCritical?"linear-gradient(90deg, hsl(0,70%,50%,0.4), hsl(0,70%,55%))":isWarn?"linear-gradient(90deg, hsl(40,90%,50%,0.4), hsl(40,90%,55%))":"linear-gradient(90deg, hsl(160,60%,50%,0.4), hsl(160,70%,55%))"}}/>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}} className="mx-2 mb-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 border border-emerald-500/10 flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">{t("الإجمالي","Total")}</span>
              <span className="text-emerald-500">
                <MagItem label={`${finTons.toFixed(1)} ${getBaseUnitLabel(productConfig, language)}`} detail={t("الإجمالي","Total")} big={finTons.toFixed(1)} sub={getBaseUnitLabel(productConfig, language)} className="inline-flex" ringColor="hsl(160,60%,50%)">{finTons.toFixed(1)} {getBaseUnitLabel(productConfig, language)}</MagItem>
              </span>
            </motion.div>
          </HoverCardContent>
        </HoverCard>

        <HoverCard openDelay={0} closeDelay={150}>
          <HoverCardTrigger asChild>
            <Card className="p-4 flex items-center gap-3 border-s-4 border-s-destructive cursor-pointer hover:shadow-md transition-shadow">
              <div className="p-2.5 bg-destructive/10 rounded-full text-destructive"><AlertCircle className="w-5 h-5"/></div>
              <div>
                <p className="text-2xl font-bold">{critCount}</p>
                <p className="text-xs text-muted-foreground">{t("نواقص حرجة","Critical")}{warnCount>0&&<span className="text-amber-500 ms-1">+{warnCount} {t("تحذير","warn")}</span>}</p>
              </div>
            </Card>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" align="start" className="p-0 rounded-2xl border-0 shadow-2xl overflow-hidden backdrop-blur-xl bg-card/95" style={{width:"var(--radix-hover-card-trigger-width)",boxShadow:"0 25px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset"}}>
            <div className="relative overflow-hidden px-4 py-3.5 bg-gradient-to-br from-destructive/25 via-destructive/10 to-background">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-destructive/20 via-transparent to-transparent pointer-events-none"/>
              <div className="absolute -top-6 -end-6 w-20 h-20 rounded-full bg-destructive/10 blur-2xl pointer-events-none"/>
              <div className="flex items-center justify-between relative">
                <span className="text-xs font-bold text-destructive">{t("التنبيهات","Alerts")}</span>
                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:300,damping:15,delay:0.05}} className="text-end">
                  <p className="text-lg font-black text-destructive leading-none">{alertItems.length}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{t("تنبيه","alert")}</p>
                </motion.div>
              </div>
            </div>
            <div className="p-2 space-y-1.5 max-h-60 overflow-y-auto">
              {alertItems.length===0&&<p className="text-xs text-muted-foreground text-center py-4">{t("جميع الأصناف طبيعية","All items are healthy")}</p>}
              {alertItems.map((i,idx)=>{
                const tons=convertToBase(productConfig, i.quantity, i.unit);
                const wh=warehouses.find(w=>w.id===i.warehouseId);
                const isCritical=i.alertLevel==="critical";
                return(
                  <motion.div key={i.id} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{duration:0.2,delay:idx*0.05,ease:"easeOut"}}
                    className="relative overflow-hidden rounded-xl border bg-background/40"
                    style={{borderColor:isCritical?"hsl(0,70%,40%,0.25)":"hsl(40,90%,50%,0.25)"}}>
                    <div className="relative px-2.5 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 max-w-[140px]">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCritical?"bg-destructive":"bg-amber-500"}`}/>
                          <span className="text-xs font-bold truncate">{i.materialName}</span>
                        </div>
                        <Badge variant="outline" className={alertColor(i.alertLevel)}>
                          <MagItem label={alertText(i.alertLevel)} detail={t("الحالة","Status")} big={alertText(i.alertLevel)} sub="" className="inline-flex" ringColor={isCritical?"hsl(0,70%,55%)":"hsl(40,90%,55%)"}>{alertText(i.alertLevel)}</MagItem>
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono font-bold">
                          <MagItem label={`${tons.toFixed(1)} ${getBaseUnitLabel(productConfig, language)}`} detail={t("الرصيد","Stock")} big={tons.toFixed(1)} sub={getBaseUnitLabel(productConfig, language)} className="inline-flex" ringColor={isCritical?"hsl(0,70%,55%)":"hsl(40,90%,55%)"}>{tons.toFixed(1)} {getBaseUnitLabel(productConfig, language)}</MagItem>
                        </span>
                        <span className="text-muted-foreground font-mono">
                          <MagItem label={i.batchNumber} detail={t("رقم التشغيلة","Batch #")} big={i.batchNumber} sub="" className="inline-flex">{i.batchNumber}</MagItem>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>
                          <MagItem label={wh?.name||i.warehouseId} detail={t("المستودع","Warehouse")} big={wh?.name||i.warehouseId} sub="" className="inline-flex" ringColor="hsl(var(--muted-foreground))">{wh?.name||i.warehouseId}</MagItem>
                        </span>
                        <span>
                          <MagItem label={`${fmtDate(i.productionDate)} → ${fmtDate(i.expiryDate)}`} detail={t("تاريخ الإنتاج→الصلاحية","Prod→Expiry")} big={fmtDate(i.productionDate)} sub={fmtDate(i.expiryDate)} className="inline-flex" ringColor="hsl(var(--muted-foreground))">{fmtDate(i.productionDate)} → {fmtDate(i.expiryDate)}</MagItem>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </HoverCardContent>
        </HoverCard>
      </motion.div>

      {/* Type filter tabs */}
      <div className="flex gap-1 p-1 bg-muted/40 border border-border/50 rounded-xl w-fit">
        {([
          { id:"all" as TabType,      label:t("الكل","All"),               count:inventory.length },
          { id:"raw" as TabType,      label:t("الخامات","Raw Materials"),  count:rawCount },
          { id:"finished" as TabType, label:t("المنتجات","Finished"),      count:finishedCount },
        ]).map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab===tab.id?"bg-background shadow text-foreground":"text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
            <span className={`min-w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1 ${activeTab===tab.id?"bg-primary/15 text-primary":"bg-muted-foreground/10"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className={`overflow-hidden transition-all duration-300 ${editMode?"ring-2 ring-primary/30 ring-offset-2 ring-offset-background":"ring-0"}`}>
        {/* Mobile card view */}
        <div className="block md:hidden divide-y divide-border">
          {(() => {
            const groups: Record<string, typeof displayItems> = {};
            displayItems.forEach(item => {
              if (!groups[item.materialName]) groups[item.materialName] = [];
              groups[item.materialName].push(item);
            });
            const entries = Object.entries(groups);
            if (entries.length === 0) {
              return (
                <div className="py-12 text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t("لا توجد عناصر في هذا القسم", "No items in this section")}</p>
                </div>
              );
            }
            return entries.map(([matName, items]) => {
              const totalQty = items.reduce((s, i) => s + i.quantity, 0);
              const first = items[0];
              const worst = items.reduce((w, i) => i.alertLevel === "critical" ? "critical" : w === "critical" ? w : i.alertLevel === "warning" ? "warning" : w, "normal");
              return (
                <motion.div key={matName} variants={itemVariants} layout className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-xs font-medium truncate">{matName}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border shrink-0 ${
                        first.type === "finished"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                          : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                      }`}>
                        {first.type === "finished" ? <Factory className="w-2 h-2 me-0.5"/> : <Package className="w-2 h-2 me-0.5"/>}
                        {first.type === "finished" ? t("منتج", "Fin") : t("خام", "Raw")}
                      </span>
                    </div>
                    <Badge variant="outline" className={alertColor(worst)}>{alertText(worst)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{totalQty}</span>
                    <span className="text-[10px] text-muted-foreground">{getUnitLabel(productConfig, first.unit, language)}</span>
                  </div>
                  <div className="space-y-1">
                    {items.map(sub => {
                      const wh = warehouses.find(w => w.id === sub.warehouseId);
                      return (
                        <div key={sub.id} className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/20 rounded-lg px-2 py-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sub.alertLevel === "critical" ? "hsl(0,70%,55%)" : sub.alertLevel === "warning" ? "hsl(40,90%,55%)" : "hsl(160,60%,50%)" }} />
                            <span className="truncate max-w-[100px]">{wh?.name || sub.warehouseId}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-foreground/70">{sub.quantity}</span>
                            <span className="text-[8px]">{getUnitLabel(productConfig, sub.unit, language)}</span>
                            {editMode && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); openEdit(sub); }} className="text-muted-foreground/30 hover:text-primary transition-colors">
                                  <Pencil className="w-2.5 h-2.5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(sub.id); }} className="text-muted-foreground/30 hover:text-destructive transition-colors">
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            });
          })()}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
              <tr>
                <th className="px-4 py-3.5">{t("الصنف","Item")}</th>
                <th className="px-4 py-3.5">{t("النوع","Type")}</th>
                <th className="px-4 py-3.5">{t("الكمية","Quantity")}</th>
                <th className="px-4 py-3.5 hidden md:table-cell">{t("المستودع","Warehouse")}</th>
                <th className="px-4 py-3.5 hidden lg:table-cell">{t("رقم التشغيلة","Batch No.")}</th>
                <th className="px-4 py-3.5 hidden lg:table-cell">{t("تاريخ الصلاحية","Expiry")}</th>
                <th className="ps-4 pe-1 py-3.5">{t("الحالة","Status")}</th>
                <th className="w-0"/>
              </tr>
            </thead>
            <motion.tbody variants={containerVariants} initial="hidden" animate="show">
              <AnimatePresence>
                {(()=>{
                  // Group items by materialName and show per-warehouse breakdown
                  const groups:Record<string,typeof displayItems>={};
                  displayItems.forEach(item=>{
                    if(!groups[item.materialName])groups[item.materialName]=[];
                    groups[item.materialName].push(item);
                  });
                  return Object.entries(groups).flatMap(([matName,items])=>{
                    const totalQty=items.reduce((s,i)=>s+i.quantity,0);
                    const first=items[0];
                    const worst=items.reduce((w,i)=>i.alertLevel==="critical"?"critical":w==="critical"?w:i.alertLevel==="warning"?"warning":w,"normal");
                    const rows:React.ReactElement[]=[];
                    // Main row
                    rows.push(
                      <motion.tr variants={itemVariants} key={matName} layout
                        className="border-b border-border bg-muted/10 group"
                      >
                        <td className="px-4 py-3 font-medium text-xs">{matName}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            first.type==="finished"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                          }`}>
                            {first.type==="finished" ? <Factory className="w-2.5 h-2.5"/> : <Package className="w-2.5 h-2.5"/>}
                            {first.type==="finished" ? t("منتج نهائي","Finished") : t("خامة","Raw")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-sm">{totalQty}</span>
                          <span className="text-muted-foreground/70 text-[10px] ms-1">{getUnitLabel(productConfig, first.unit, language)}</span>
                          {/* Per-warehouse breakdown */}
                          <div className="mt-1 space-y-0.5">
                            {items.map(sub=>{
                              const wh=warehouses.find(w=>w.id===sub.warehouseId);
                              return(
                                <div key={sub.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:sub.alertLevel==="critical"?"hsl(0,70%,55%)":sub.alertLevel==="warning"?"hsl(40,90%,55%)":"hsl(160,60%,50%)"}}/>
                                  <span className="truncate max-w-[80px]">{wh?.name||sub.warehouseId}</span>
                                  <span className="font-mono font-bold text-foreground/70">{sub.quantity}</span>
                                  <span className="text-[8px]">{getUnitLabel(productConfig, sub.unit, language)}</span>
                                  {editMode&&<>
                                    <button onClick={(e)=>{e.stopPropagation();openEdit(sub);}} className="ms-auto text-muted-foreground/30 hover:text-primary transition-colors"><Pencil className="w-2.5 h-2.5"/></button>
                                    <button onClick={(e)=>{e.stopPropagation();handleDeleteItem(sub.id);}} className="text-muted-foreground/30 hover:text-destructive transition-colors"><Trash2 className="w-2.5 h-2.5"/></button>
                                  </>}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell align-top text-xs">
                          <div className="space-y-0.5">
                            {items.map(sub=>{
                              const wh=warehouses.find(w=>w.id===sub.warehouseId);
                              return <div key={sub.id} className="truncate">{wh?.name||sub.warehouseId}</div>;
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell align-top text-xs">
                          <div className="space-y-0.5">
                            {items.map(sub=><div key={sub.id} className="font-mono truncate">{sub.batchNumber}</div>)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell align-top text-xs">
                          <div className="space-y-0.5">
                            {items.map(sub=><div key={sub.id}>{fmtDate(sub.expiryDate)}</div>)}
                          </div>
                        </td>
                        <td className="ps-4 pe-1 py-3 align-top">
                          <Badge variant="outline" className={alertColor(worst)}>{alertText(worst)}</Badge>
                          {editMode&&<div className="mt-1 space-y-0.5">{items.map(sub=><div key={sub.id} className="flex gap-2"><button onClick={(e)=>{e.stopPropagation();openEdit(sub);}} className="text-[9px] text-muted-foreground hover:text-primary transition-colors">{t("تعديل","Edit")}</button><button onClick={(e)=>{e.stopPropagation();handleDeleteItem(sub.id);}} className="text-[9px] text-muted-foreground hover:text-destructive transition-colors">{t("حذف","Delete")}</button></div>)}</div>}
                        </td>
                      </motion.tr>
                    );
                    return rows;
                  });
                })()}
              </AnimatePresence>
            </motion.tbody>
          </table>
          {displayItems.length===0&&(
            <div className="py-12 text-center"><Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30"/><p className="text-sm text-muted-foreground">{t("لا توجد عناصر في هذا القسم","No items in this section")}</p></div>
          )}
        </div>
      </Card>

      {/* Add Item Sheet */}
      <Sheet open={addOpen} onOpenChange={v=>{setAddOpen(v);if(!v)setBagRows([]);}}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("إضافة صنف جديد","Add New Item")}</SheetTitle>
            <SheetDescription>{t("أضف خامة أو منتج جديد إلى المخزون","Add a new raw material or finished product")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("نوع الصنف","Item Type")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["raw","finished"] as const).map(tp=>(
                  <button key={tp} type="button" onClick={()=>setNewType(tp)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${newType===tp?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:bg-muted"}`}>
                    {tp==="raw"?<Package className="w-4 h-4"/>:<Factory className="w-4 h-4"/>}
                    {tp==="raw"?t("خامة","Raw Material"):t("منتج نهائي","Finished Product")}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>{t("اسم المادة","Material Name")}</Label><SmartInput field="material-name" value={newMaterial} onChange={setNewMaterial} extraSuggestions={[...new Set([...inventory.map(i=>i.materialName), ...getFeedTermSuggestions()])]} placeholder={t("مثال: ذرة صفراء...","e.g. Yellow Corn...")} data-testid="input-inventory-material"/></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("الكمية","Quantity")}</Label><Input type="number" min="0" value={newQty} onChange={e=>setNewQty(e.target.value)} data-testid="input-inventory-qty"/></div>
              <div className="space-y-2">
                <Label>{t("الوحدة","Unit")}</Label>
                <Select value={newUnit} onValueChange={v=>setNewUnit(v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {productConfig.units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{language === "ar" ? u.labelAr : u.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {productConfig.showPackageWeight && (<>
            {/* ── Bags (optional) — same style as Production ── */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><PackageCheck className="w-3.5 h-3.5 text-muted-foreground"/>{t("الشكاير (اختياري)","Bags (optional)")}</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{t("أضف مقاس:","Add size:")}</span>
                {PRESET_WEIGHTS.map(kg=>(
                  <button key={kg} type="button" onClick={()=>addPresetBag(kg)} disabled={!!bagRows.find(b=>b.weightKg===kg)}
                    className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-muted/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary border-border">
                    {kg} {getUnitLabel(productConfig, "kg", language)}
                  </button>
                ))}
                <button type="button" onClick={addCustomBag}
                  className="px-2.5 py-1 rounded-lg border border-dashed text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all">
                  + {t("مقاس مخصص","Custom")}
                </button>
              </div>
              {bagRows.length>0&&(
                <div className="rounded-xl border overflow-hidden divide-y">
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-3 py-2 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                    <span>{t("الوزن (ك)","Wt (kg)")}</span><span>{t("العدد","Count")}</span><span className="text-end">{t("الإجمالي","Total")}</span><span/>
                  </div>
                  {bagRows.map(b=>{
                    const rowTons=(b.count*b.weightKg)/1000;
                    return(
                      <div key={b.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center px-3 py-2">
                        <Input type="number" min="1" placeholder={t("الوزن","Weight")} className="h-8 text-xs font-mono" value={b.weightKg||""} onChange={e=>updBag(b.id,"weightKg",+e.target.value)}/>
                        <Input type="number" min="0" placeholder="0" className="h-8 text-xs font-mono" value={b.count||""} onChange={e=>updBag(b.id,"count",+e.target.value)}/>
                        <span className="text-xs font-medium text-primary text-end whitespace-nowrap">{rowTons>0?`${rowTons%1===0?rowTons:rowTons.toFixed(2)} ${getBaseUnitLabel(productConfig, language)}`:"—"}</span>
                        <button type="button" onClick={()=>remBag(b.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button>
                      </div>
                    );
                  })}
                  {bagRows.some(b=>b.count>0&&b.weightKg>0)&&(
                    <div className="flex items-center justify-between px-3 py-2 bg-primary/5 text-xs font-semibold">
                      <span className="text-muted-foreground">{t("الإجمالي:","Total:")} {bagTotal()} {getUnitLabel(productConfig, "bag", language)}</span>
                      <span className="text-primary">{bagTons().toFixed(3)} {getBaseUnitLabel(productConfig, language)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            </>)}
            <div className="space-y-2">
              <Label>{t("المخزن","Warehouse")}</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={newWarehouse} onValueChange={setNewWarehouse}>
                    <SelectTrigger data-testid="select-inventory-warehouse"><SelectValue placeholder={t("اختر المخزن","Select warehouse")}/></SelectTrigger>
                    <SelectContent>{warehouses.map(w=><SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={()=>setWhAddOpen(true)} title={t("مخزن جديد","New Warehouse")}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2"><Label>{t("تاريخ الصلاحية","Expiry Date")}</Label><Input type="date" value={newExpiry} onChange={e=>setNewExpiry(e.target.value)} data-testid="input-inventory-expiry"/></div>
            <AnimatePresence mode="wait">
              {submitted?(
                <motion.div key="s" initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-lg"><CheckCircle2 className="w-5 h-5"/><span className="font-medium">{t("تم الإضافة!","Item added!")}</span></motion.div>
              ):(
                <motion.div key="b" className="flex gap-3">
                  <Button className="flex-1" onClick={handleAddSubmit} disabled={!newMaterial||!newQty||!newWarehouse} data-testid="button-submit-inventory-item">{t("إضافة الصنف","Add Item")}</Button>
                  <Button variant="outline" onClick={()=>setAddOpen(false)}>{t("إلغاء","Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Item Sheet */}
      <Sheet open={editOpen} onOpenChange={v=>{setEditOpen(v);if(!v){setEditItemId(null);setBagRows([]);}}}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("تعديل الصنف","Edit Item")}</SheetTitle>
            <SheetDescription>{t("تعديل بيانات الصنف المختار","Update the selected item's details")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("نوع الصنف","Item Type")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["raw","finished"] as const).map(tp=>(
                  <button key={tp} type="button" onClick={()=>setEditType(tp)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${editType===tp?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:bg-muted"}`}>
                    {tp==="raw"?<Package className="w-4 h-4"/>:<Factory className="w-4 h-4"/>}
                    {tp==="raw"?t("خامة","Raw Material"):t("منتج نهائي","Finished Product")}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>{t("اسم المادة","Material Name")}</Label><SmartInput field="material-name" value={editMaterial} onChange={setEditMaterial} extraSuggestions={[...new Set([...inventory.map(i=>i.materialName), ...getFeedTermSuggestions()])]} placeholder={t("مثال: ذرة صفراء...","e.g. Yellow Corn...")}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("المتبقي","Remaining")}</Label><Input type="number" min="0" value={editQty} onChange={e=>setEditQty(e.target.value)}/></div>
              <div className="space-y-2">
                <Label>{t("الوحدة","Unit")}</Label>
                <Select value={editUnit} onValueChange={v=>setEditUnit(v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {productConfig.units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{language === "ar" ? u.labelAr : u.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {productConfig.showPackageWeight && (<>
            {/* ── Bags (optional) — same style as Production ── */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><PackageCheck className="w-3.5 h-3.5 text-muted-foreground"/>{t("الشكاير (اختياري)","Bags (optional)")}</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{t("أضف مقاس:","Add size:")}</span>
                {PRESET_WEIGHTS.map(kg=>(
                  <button key={kg} type="button" onClick={()=>addPresetBag(kg)} disabled={!!bagRows.find(b=>b.weightKg===kg)}
                    className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-muted/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary border-border">
                    {kg} {getUnitLabel(productConfig, "kg", language)}
                  </button>
                ))}
                <button type="button" onClick={addCustomBag}
                  className="px-2.5 py-1 rounded-lg border border-dashed text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all">
                  + {t("مقاس مخصص","Custom")}
                </button>
              </div>
              {bagRows.length>0&&(
                <div className="rounded-xl border overflow-hidden divide-y">
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-3 py-2 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                    <span>{t("الوزن (ك)","Wt (kg)")}</span><span>{t("العدد","Count")}</span><span className="text-end">{t("الإجمالي","Total")}</span><span/>
                  </div>
                  {bagRows.map(b=>{
                    const rowTons=(b.count*b.weightKg)/1000;
                    return(
                      <div key={b.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center px-3 py-2">
                        <Input type="number" min="1" placeholder={t("الوزن","Weight")} className="h-8 text-xs font-mono" value={b.weightKg||""} onChange={e=>updBag(b.id,"weightKg",+e.target.value)}/>
                        <Input type="number" min="0" placeholder="0" className="h-8 text-xs font-mono" value={b.count||""} onChange={e=>updBag(b.id,"count",+e.target.value)}/>
                        <span className="text-xs font-medium text-primary text-end whitespace-nowrap">{rowTons>0?`${rowTons%1===0?rowTons:rowTons.toFixed(2)} ${getBaseUnitLabel(productConfig, language)}`:"—"}</span>
                        <button type="button" onClick={()=>remBag(b.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button>
                      </div>
                    );
                  })}
                  {bagRows.some(b=>b.count>0&&b.weightKg>0)&&(
                    <div className="flex items-center justify-between px-3 py-2 bg-primary/5 text-xs font-semibold">
                      <span className="text-muted-foreground">{t("الإجمالي:","Total:")} {bagTotal()} {getUnitLabel(productConfig, "bag", language)}</span>
                      <span className="text-primary">{bagTons().toFixed(3)} {getBaseUnitLabel(productConfig, language)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            </>)}
            <div className="space-y-2">
              <Label>{t("المخزن","Warehouse")}</Label>
              <Select value={editWarehouse} onValueChange={setEditWarehouse}>
                <SelectTrigger><SelectValue placeholder={t("اختر المخزن","Select warehouse")}/></SelectTrigger>
                <SelectContent>{warehouses.map(w=><SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{t("تاريخ الصلاحية","Expiry Date")}</Label><Input type="date" value={editExpiry} onChange={e=>setEditExpiry(e.target.value)}/></div>
            <AnimatePresence mode="wait">
              {editDone?(
                <motion.div key="s" initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-lg"><CheckCircle2 className="w-5 h-5"/><span className="font-medium">{t("تم التعديل!","Item updated!")}</span></motion.div>
              ):(
                <motion.div key="b" className="flex gap-3">
                  <Button className="flex-1" onClick={handleEditSubmit} disabled={!editMaterial||!editQty||!editWarehouse} data-testid="button-update-inventory-item">{t("حفظ التعديلات","Save Changes")}</Button>
                  <Button variant="outline" onClick={()=>{setEditOpen(false);setEditItemId(null);}}>{t("إلغاء","Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* Transfer Sheet */}
      <Sheet open={transferOpen} onOpenChange={setTransferOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6"><SheetTitle>{t("نقل بين المخازن","Warehouse Transfer")}</SheetTitle><SheetDescription>{t("انقل كميات بين المخازن المختلفة","Transfer quantities between warehouses")}</SheetDescription></SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("الصنف","Item")}</Label>
              <SmartInput field="material-name" value={transferItem} onChange={v=>{setTransferItem(v);const item=inventory.find(i=>i.materialName===v);if(item){setTransferUnit(item.unit);}}} extraSuggestions={[...materialNames, ...getFeedTermSuggestions()]} placeholder={t("اختر أو اكتب اسم المادة","Select or type material name")} />
              {transferItem&&(()=>{
                const si=inventory.find(i=>i.materialName===transferItem);
                return si?<p className="text-[11px] text-muted-foreground mt-1">{t("المخزن الحالي","Current warehouse")}: {warehouses.find(w=>w.id===si.warehouseId)?.name||si.warehouseId} · {t("المتوفر","Available")}: {si.quantity} {getUnitLabel(productConfig, si.unit, language)}</p>:null;
              })()}
            </div>
            <div className="space-y-2">
              <Label>{t("إلى مخزن","To Warehouse")}</Label>
              <Select value={toWarehouse} onValueChange={setToWarehouse}>
                <SelectTrigger><SelectValue placeholder={t("اختر المخزن الوجهة","Select destination")}/></SelectTrigger>
                <SelectContent>{warehouses.filter(w=>{const si=inventory.find(i=>i.materialName===transferItem);return !si||w.id!==si.warehouseId;}).map(w=><SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("الكمية","Quantity")}</Label><Input type="number" min="1" value={transferQty} onChange={e=>setTransferQty(e.target.value)} data-testid="input-transfer-qty"/></div>
              <div className="space-y-2">
                <Label>{t("الوحدة","Unit")}</Label>
                <Select value={transferUnit} onValueChange={v=>setTransferUnit(v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {productConfig.units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{language === "ar" ? u.labelAr : u.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {transferDone?(
                <motion.div key="s" initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-lg"><CheckCircle2 className="w-5 h-5"/><span className="font-medium">{t("تم النقل بنجاح!","Transfer successful!")}</span></motion.div>
              ):(
                <motion.div key="b" className="flex gap-3">
                  <Button className="flex-1" onClick={handleTransferSubmit} disabled={!transferItem||!toWarehouse||!transferQty||parseFloat(transferQty)<=0} data-testid="button-submit-transfer">{t("تأكيد النقل","Confirm Transfer")}</Button>
                  <Button variant="outline" onClick={()=>setTransferOpen(false)}>{t("إلغاء","Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Inventory Report Dialog ── */}
      <Dialog open={reportOpen} onOpenChange={v=>{if(!reportGenerating)setReportOpen(v);}}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary"/>
              {t("تقرير المخزون","Inventory Report")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!reportGenerating&&!reportGenerated&&(
              <>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">{t("الفترة","Period")}</Label>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {([{mode:"all" as DateMode,label:t("الكل","All")},{mode:"today" as DateMode,label:t("اليوم","Today")},{mode:"range" as DateMode,label:t("مخصص","Custom")}]).map(d=>(
                      <button key={d.mode} onClick={()=>{setReportDateMode(d.mode);if(d.mode!=="range"){setReportDateFrom("");setReportDateTo("");}}}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reportDateMode===d.mode?"bg-primary text-primary-foreground shadow-sm":"bg-muted/60 text-muted-foreground hover:bg-muted"}`}>{d.label}</button>
                    ))}
                  </div>
                  {reportDateMode==="range"&&(
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mt-2">
                      <Input type="date" className="h-8 text-xs w-28 sm:w-36 rounded-lg" value={reportDateFrom} onChange={e=>setReportDateFrom(e.target.value)}/>
                      <span className="text-muted-foreground text-xs">{t("إلى","to")}</span>
                      <Input type="date" className="h-8 text-xs w-28 sm:w-36 rounded-lg" value={reportDateTo} onChange={e=>setReportDateTo(e.target.value)}/>
                    </div>
                  )}
                </div>
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs sm:text-sm">{t("النوع","Type")}</Label>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {(["all","raw","finished"] as const).map(tp=>(
                      <button key={tp} onClick={()=>setReportType(tp)}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reportType===tp?"bg-primary text-primary-foreground shadow-sm":"bg-muted/60 text-muted-foreground hover:bg-muted"}`}>
                        {tp==="all"?t("الكل","All"):tp==="raw"?t("خامات","Raw"):t("منتجات","Finished")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs sm:text-sm">{t("الأقسام","Sections")}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {key:"summary",label:t("ملخص المخزون","Summary"),val:reportSummary,set:setReportSummary},
                      {key:"alerts",label:t("المواد الحرجة","Critical Items"),val:reportAlerts,set:setReportAlerts},
                      {key:"listing",label:t("كشف الجرد","Listing"),val:reportListing,set:setReportListing},
                    ].map(s=>(
                      <button key={s.key} type="button" onClick={()=>s.set(!s.val)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all ${s.val?"bg-primary/10 border-primary/30 text-primary":"bg-muted/30 border-border/50 text-muted-foreground hover:border-border"}`}>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${s.val?"bg-primary border-primary":"border-muted-foreground/30"}`}>
                          {s.val&&<svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                        </div>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button className="flex-1 gap-2 text-xs sm:text-sm" onClick={handleGenerateInventoryReport} disabled={reportDateMode==="range"&&!reportDateFrom&&!reportDateTo}>
                    <BarChart3 className="w-3.5 h-3.5"/>{t("إنشاء التقرير","Generate")}
                  </Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={()=>setReportOpen(false)}>{t("إلغاء","Cancel")}</Button>
                </div>
              </>
            )}
            {reportGenerating&&(
              <motion.div initial={{opacity:0}} animate={{opacity:1}} className="py-8 flex flex-col items-center gap-4">
                <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                  <motion.div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent" animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}/>
                  <div className="absolute inset-0 flex items-center justify-center"><BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary"/></div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("جاري إنشاء التقرير...","Generating...")}</p>
              </motion.div>
            )}
            {reportGenerated&&(
              <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="py-4 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:300,delay:0.1}} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500"/>
                  </motion.div>
                  <p className="text-sm sm:text-base font-semibold text-emerald-500">{t("تم إنشاء التقرير!","Report generated!")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="gap-2 text-xs sm:text-sm" onClick={handleDownloadInventoryPDF}>
                    <Download className="w-3.5 h-3.5"/>{t("تحميل PDF","Download PDF")}
                  </Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={()=>{setReportOpen(false);setReportGenerated(false);}}>{t("إغلاق","Close")}</Button>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Warehouse Dialog ── */}
      <Dialog open={whAddOpen} onOpenChange={setWhAddOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4 text-primary"/>
              {t("مخزن جديد","New Warehouse")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("اسم المخزن","Warehouse Name")}</Label>
              <SmartInput field="warehouse-name" value={whNewName} onChange={setWhNewName} extraSuggestions={warehouseConfigs.map(w=>w.name)} placeholder={t("مثلاً: مخزن التبريد","e.g. Cold Storage")} />
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" disabled={!whNewName.trim()} onClick={async()=>{
                const id = `W${Date.now()}`;
                await addWarehouseConfig({ id, name: whNewName.trim(), normalThreshold: 50, warningThreshold: 20 });
                setNewWarehouse(id);
                setWhNewName("");
                setWhAddOpen(false);
              }}>{t("إضافة المخزن","Add Warehouse")}</Button>
              <Button variant="outline" onClick={()=>{setWhAddOpen(false);setWhNewName("");}}>{t("إلغاء","Cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Linked PO Alert Dialog ── */}
      <Dialog open={!!linkedPoAlert} onOpenChange={v => { if (!v) setLinkedPoAlert(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4"/>
              {t("لا يمكن الحذف", "Cannot Delete")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {linkedPoAlert && t(
                `هذا الصنف "${linkedPoAlert.name}" مرتبط بـ ${linkedPoAlert.count} فاتورة مشتريات. احذف الفاتورة أولاً.`,
                `Item "${linkedPoAlert.name}" is linked to ${linkedPoAlert.count} purchase order(s). Delete the order(s) first.`
              )}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setLinkedPoAlert(null)}>{t("حسناً", "OK")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={v => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-destructive">
              <Trash2 className="w-4 h-4"/>
              {t("حذف الصنف", "Delete Item")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("هل أنت متأكد من حذف هذا الصنف من المخزن؟ لا يمكن التراجع عن هذا الإجراء.", "Are you sure you want to delete this item from inventory? This action cannot be undone.")}
            </p>
            <div className="flex gap-3">
              <Button variant="destructive" className="flex-1 gap-2" onClick={confirmDelete}>
                <Trash2 className="w-4 h-4"/>{t("حذف", "Delete")}
              </Button>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>{t("إلغاء", "Cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
