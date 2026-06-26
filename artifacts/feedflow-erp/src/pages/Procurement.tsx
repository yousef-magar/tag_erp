import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useProcurementStore, type Supplier, type PurchaseOrder, type PurchaseReturn, type PurchaseOrderItem } from "@/hooks/use-procurement-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SmartInput from "@/components/SmartInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { usePricingStore } from "@/hooks/use-pricing-store";
import { BarChart3, Download, FileText, Plus, ShoppingBag, CheckCircle2, Package, DollarSign, RotateCcw, Trash2, Search, X, CalendarDays, Clock, CalendarRange, ArrowLeftRight, Store, Hash, Edit3, Phone, MapPin, CreditCard, Banknote, HandCoins, Receipt, AlertTriangle, AlertCircle, UserPlus, Smartphone, Settings2, Pencil, Check } from "lucide-react";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const headerVariants = { hidden: { opacity: 0, y: -12, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 120, damping: 14 } } };
const cardVariants = { hidden: { opacity: 0, y: 12, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 13 } } };

const fmtCurrency = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("T")[0].split("-"); if (p.length !== 3) return d; return `${p[2]}/${p[1]}/${p[0]}`; };

function loadMaterials(): string[] {
  try { const s = localStorage.getItem("ff-materials"); if (s) return JSON.parse(s); } catch {}
  return [];
}
function saveMaterials(list: string[]) {
  localStorage.setItem("ff-materials", JSON.stringify(list));
}
const units = ["طن", "كجم", "شيكارة"];

type ProcTab = "orders" | "returns" | "suppliers";

function orderRemaining(o: PurchaseOrder) { return Math.max(0, o.total - (o.paidAmount || 0)); }

export default function Procurement() {
  const { t, language, bankAccounts, walletAccounts, updateBankBalance, updateWalletBalance } = useAppStore();
  const { inventory, warehouseConfigs, addInventoryItem, updateInventoryItem, deleteInventoryItemsBySource, addWarehouseConfig, updateWarehouseConfig, deleteWarehouseConfig } = useProductionStore();
  const { suppliers, orders, returns, payments, addSupplier, updateSupplier, deleteSupplier, addOrder, updateOrder, deleteOrder, addReturn, addPayment, nextOrderNum, nextReturnNum } = useProcurementStore();

  const [tab, setTab] = useState<ProcTab>("orders");

  // New PO
  const [poOpen, setPoOpen] = useState(false);
  const [poDone, setPoDone] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [materialsList, setMaterialsList] = useState(loadMaterials);
  useEffect(() => { saveMaterials(materialsList); }, [materialsList]);
  const [poItems, setPoItems] = useState<{ material: string; qty: string; unit: string; price: string }[]>([{ material: "", qty: "", unit: "طن", price: "" }]);
  const [poShowAddSup, setPoShowAddSup] = useState(false);
  const [poNewSupName, setPoNewSupName] = useState("");
  const [poNewSupPhone, setPoNewSupPhone] = useState("");
  const [poShowAddMat, setPoShowAddMat] = useState(false);
  const [poNewMatName, setPoNewMatName] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poIsCredit, setPoIsCredit] = useState(false);
  const [poDueDate, setPoDueDate] = useState("");
  const [poPayMethod, setPoPayMethod] = useState<"cash" | "bank_transfer" | "vodafone_cash" | "instapay">("cash");
  const [poPayBank, setPoPayBank] = useState("");
  const [poEditId, setPoEditId] = useState<string | null>(null);
  const [poWarehouse, setPoWarehouse] = useState(warehouseConfigs[0]?.id || "W1");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteBlockedName, setDeleteBlockedName] = useState<string | null>(null);
  const [poShowAddWh, setPoShowAddWh] = useState(false);
  const [poNewWhName, setPoNewWhName] = useState("");
  const [poWhManageOpen, setPoWhManageOpen] = useState(false);
  const [poEditWhId, setPoEditWhId] = useState<string | null>(null);
  const [poEditWhName, setPoEditWhName] = useState("");

  // Return
  const [retOpen, setRetOpen] = useState(false);
  const [retSearch, setRetSearch] = useState("");
  const [retSelectedSup, setRetSelectedSup] = useState<string | null>(null);
  const [retPoId, setRetPoId] = useState("");
  const [retItems, setRetItems] = useState<{ material: string; qty: string; unit: string; price: string }[]>([{ material: "", qty: "", unit: "طن", price: "" }]);
  const [retShowAddMat, setRetShowAddMat] = useState(false);
  const [retNewMatName, setRetNewMatName] = useState("");
  const [retReason, setRetReason] = useState("");

  // Suppliers CRUD
  const [supOpen, setSupOpen] = useState(false);
  const [supEditId, setSupEditId] = useState<string | null>(null);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supCode, setSupCode] = useState("");
  const [supAddr, setSupAddr] = useState("");
  const [supMaterial, setSupMaterial] = useState("");

  // Payment dialog
  const [paySup, setPaySup] = useState<Supplier | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "bank_transfer" | "vodafone_cash" | "instapay">("cash");
  const [payBank, setPayBank] = useState("");
  const [payAlloc, setPayAlloc] = useState<Record<string, number>>({});
  const [payNotes, setPayNotes] = useState("");

  // Search & filters
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateMode, setDateMode] = useState<"all" | "today" | "custom">("all");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repSummary, setRepSummary] = useState(true);
  const [repOrders, setRepOrders] = useState(true);
  const [repSuppliers, setRepSuppliers] = useState(true);
  const [repSupId, setRepSupId] = useState("");
  const [repSupSearch, setRepSupSearch] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];

  const poTotal = poItems.reduce((s, item) => s + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0), 0);
  const retTotal = retItems.reduce((s, item) => s + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0), 0);

  const poSupplierOrders = useMemo(() => {
    if (!poSupplierId) return [];
    return orders.filter(o => o.supplierId === poSupplierId && o.status !== "paid");
  }, [orders, poSupplierId]);

  // Overdue detection
  const overdueOrders = useMemo(() => {
    return orders.filter(o => o.dueDate && o.dueDate < todayStr && o.status !== "paid");
  }, [orders, todayStr]);

  // Filtered POs
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filterStatus !== "all") result = result.filter(o => o.status === filterStatus);
    if (dateMode === "today") result = result.filter(o => o.date === todayStr);
    if (dateMode === "custom") {
      if (dateFrom) result = result.filter(o => o.date >= dateFrom);
      if (dateTo) result = result.filter(o => o.date <= dateTo);
    }
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      result = result.filter(o => o.id.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q) || o.items.some(i => i.material.toLowerCase().includes(q)));
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortField === "id") cmp = a.id.localeCompare(b.id);
        else if (sortField === "supplierName") cmp = a.supplierName.localeCompare(b.supplierName);
        else if (sortField === "total") cmp = a.total - b.total;
        else if (sortField === "status") cmp = a.status.localeCompare(b.status);
        else if (sortField === "date") cmp = a.date.localeCompare(b.date);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [orders, searchQ, filterStatus, dateFrom, dateTo, dateMode, todayStr, sortField, sortDir]);

  const filteredReturns = useMemo(() => {
    let result = returns;
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      result = result.filter(r => r.id.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q) || r.items.some(i => i.material.toLowerCase().includes(q)));
    }
    return result;
  }, [returns, searchQ]);

  const filteredSuppliers = useMemo(() => {
    if (!searchQ.trim()) return suppliers;
    const q = searchQ.trim().toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.code.toLowerCase().includes(q) || s.material.toLowerCase().includes(q));
  }, [suppliers, searchQ]);

  // Stats
  const stats = useMemo(() => {
    const f = tab === "orders" ? filteredOrders : tab === "returns" ? filteredReturns : filteredSuppliers;
    return {
      total: tab === "orders" ? f.length : tab === "returns" ? f.length : f.length,
      value: tab === "orders" ? filteredOrders.reduce((s, o) => s + Number(o.total || 0), 0) : tab === "returns" ? filteredReturns.reduce((s, r) => s + Number(r.total || 0), 0) : 0,
      pending: tab === "orders" ? orders.filter(o => o.status === "pending").length : 0,
      overdue: tab === "orders" ? overdueOrders.length : 0,
      supDebt: suppliers.reduce((s, sup) => s + Number(sup.outstandingDebt || 0), 0),
    };
  }, [tab, filteredOrders, filteredReturns, filteredSuppliers, orders, overdueOrders, suppliers]);

  const addPoItem = () => setPoItems(prev => [...prev, { material: "", qty: "", unit: "طن", price: "" }]);
  const removePoItem = (idx: number) => setPoItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  const updatePoItem = (idx: number, field: "material" | "qty" | "unit" | "price", value: string) =>
    setPoItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const handleSubmitPO = async () => {
    if (!poSupplierId || poItems.length === 0 || poItems.some(item => !item.material || !item.qty || !item.price)) return;
    const sup = suppliers.find(s => s.id === poSupplierId);
    const items = poItems.map(item => {
      const qty = parseFloat(item.qty);
      const price = parseFloat(item.price);
      return { material: item.material, qty, unit: item.unit as any, unitPrice: price, total: qty * price };
    });
    const total = items.reduce((s, i) => s + i.total, 0);
    const isPaid = !poIsCredit;
    const newId = poEditId || `PO-${String(nextOrderNum()).padStart(4, "0")}`;
    const order: PurchaseOrder = {
      id: newId,
      supplierId: poSupplierId,
      supplierName: sup?.name || "",
      date: poEditId ? orders.find(o => o.id === poEditId)?.date || todayStr : todayStr,
      dueDate: poIsCredit && poDueDate ? poDueDate : undefined,
      status: isPaid ? "paid" : "pending",
      items,
      total,
      paidAmount: isPaid ? total : 0,
      payMethod: isPaid ? poPayMethod : undefined,
      payBank: isPaid && poPayMethod !== "cash" ? poPayBank : undefined,
      notes: poNotes || undefined,
    };

    if (poEditId) {
      await updateOrder(poEditId, order);
    } else {
      await addOrder(order);

      // Pricing alerts for each procured material
      for (const item of items) {
        usePricingStore.getState().addPricingAlert(item.material, item.unitPrice || 0, "procurement");
      }

      // Update inventory for each item (also syncs to pricing store)
      for (const item of items) {
        const unit = item.unit === "كجم" ? "kg" : item.unit === "شيكارة" ? "bag" : "ton";
        await addInventoryItem({
          id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          materialName: item.material,
          quantity: item.qty, initialQuantity: item.qty, consumedQuantity: 0,
          unit: unit as any, warehouseId: poWarehouse,
          batchNumber: `B-${todayStr}`, productionDate: todayStr,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          alertLevel: "normal", type: "raw",
          source: newId,
        });
      }

      // Sync raw material costs now that pricing entries exist
      usePricingStore.getState().syncRawCostsFromProcurement();

      // Handle payment
      if (isPaid && poPayMethod === "bank_transfer" && poPayBank) {
        updateBankBalance(poPayBank, -total);
      } else if (isPaid && (poPayMethod === "vodafone_cash" || poPayMethod === "instapay") && poPayBank) {
        updateWalletBalance(poPayBank, -total);
      }
    }

    setPoDone(true);
    setTimeout(() => {
      setPoDone(false); setPoOpen(false);
      setPoEditId(null);
      setPoSupplierId("");
      setPoItems([{ material: "", qty: "", unit: "طن", price: "" }]);
      setPoShowAddSup(false); setPoNewSupName(""); setPoNewSupPhone("");
      setPoShowAddMat(false); setPoNewMatName("");
      setPoNotes(""); setPoIsCredit(false); setPoDueDate(""); setPoPayMethod("cash"); setPoPayBank("");
    }, 1400);
  };

  const addRetItem = () => setRetItems(prev => [...prev, { material: "", qty: "", unit: "طن", price: "" }]);
  const removeRetItem = (idx: number) => setRetItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  const updateRetItem = (idx: number, field: "material" | "qty" | "unit" | "price", value: string) =>
    setRetItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const handleSubmitReturn = () => {
    if (!retPoId || retItems.length === 0 || retItems.some(item => !item.material || !item.qty || !item.price)) return;
    const po = orders.find(o => o.id === retPoId);
    const sup = po ? suppliers.find(s => s.id === po.supplierId) : null;
    const items = retItems.map(item => {
      const qty = parseFloat(item.qty);
      const price = parseFloat(item.price);
      return { material: item.material, qty, unit: item.unit as any, unitPrice: price, total: qty * price };
    });
    const total = items.reduce((s, i) => s + i.total, 0);
    const ret: PurchaseReturn = {
      id: `PR-${String(nextReturnNum()).padStart(4, "0")}`,
      poId: retPoId, supplierId: po?.supplierId || "", supplierName: sup?.name || "",
      date: todayStr, items, total,
      reason: retReason,
    };
    addReturn(ret);

    // Deduct from inventory for each item
    const deductions = new Map<string, { qty: number; invUnit: string }>();
    for (const item of items) {
      const qty = item.qty || 0;
      const matches = inventory.filter(i => i.type === "raw" && i.materialName === item.material);
      for (const match of matches) {
        const current = deductions.get(match.id);
        const accQty = current ? current.qty : 0;
        let deduct = qty;
        if (match.unit === "ton" && item.unit === "كجم") deduct = qty / 1000;
        else if (match.unit === "kg" && (item.unit === "طن" || item.unit === "ton")) deduct = qty * 1000;
        else if (match.unit === "kg" && item.unit === "شيكارة") deduct = qty * 50;
        deductions.set(match.id, { qty: accQty + deduct, invUnit: match.unit });
        break;
      }
    }
    for (const [id, { qty: totalDeduct }] of deductions) {
      const match = inventory.find(i => i.id === id);
      if (match) {
        updateInventoryItem(id, { quantity: Math.max(0, +(match.quantity - totalDeduct).toFixed(3)) });
      }
    }

    setRetOpen(false);
    setRetPoId(""); setRetSearch(""); setRetSelectedSup(null);
    setRetItems([{ material: "", qty: "", unit: "طن", price: "" }]);
    setRetShowAddMat(false); setRetNewMatName("");
    setRetReason("");
  };

  const handleSaveSupplier = () => {
    if (!supName.trim()) return;
    if (supEditId) {
      updateSupplier(supEditId, { name: supName.trim(), phone: supPhone.trim(), code: supCode.trim(), address: supAddr.trim(), material: supMaterial.trim() });
    } else {
      addSupplier({ name: supName.trim(), phone: supPhone.trim(), code: supCode.trim() || `SUP-${Date.now()}`, address: supAddr.trim(), material: supMaterial.trim(), outstandingDebt: 0, status: "active" });
    }
    setSupOpen(false); setSupEditId(null); setSupName(""); setSupPhone(""); setSupCode(""); setSupAddr(""); setSupMaterial("");
  };

  const handleAutoAlloc = () => {
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0 || !paySup) return;
    const unpaid = orders.filter(o => o.supplierId === paySup.id && o.status !== "paid");
    const map: Record<string, number> = {};
    let rem = amt;
    for (const o of unpaid) {
      if (rem <= 0) break;
      const left = orderRemaining(o);
      const alloc = Math.min(rem, left);
      if (alloc > 0) map[o.id] = alloc;
      rem -= alloc;
    }
    setPayAlloc(map);
  };

  const handlePaySupplier = () => {
    if (!paySup || !payAmount) return;
    const totalPay = parseFloat(payAmount) || 0;
    if (totalPay <= 0) return;
    const allocations = Object.entries(payAlloc).filter(([, a]) => a > 0).map(([poId, amount]) => ({ poId, amount }));
    if (allocations.length === 0) return;

    addPayment({
      id: `PAY-${Date.now()}`,
      supplierId: paySup.id,
      supplierName: paySup.name,
      date: todayStr,
      amount: totalPay,
      method: payMethod,
      bankId: payMethod !== "cash" ? payBank : undefined,
      allocations,
      notes: payNotes || undefined,
    });

    if (payMethod === "bank_transfer" && payBank) {
      updateBankBalance(payBank, -totalPay);
    } else if ((payMethod === "vodafone_cash" || payMethod === "instapay") && payBank) {
      updateWalletBalance(payBank, -totalPay);
    }

    setPayOpen(false); setPaySup(null); setPayAmount(""); setPayMethod("cash"); setPayBank(""); setPayAlloc({}); setPayNotes("");
  };

  const StatusBadge = ({ status, dueDate }: { status: string; dueDate?: string }) => {
    const isOverdue = status !== "paid" && dueDate && dueDate < todayStr;
    const color = isOverdue ? "bg-destructive/10 text-destructive border-destructive/20"
      : status === "paid" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      : status === "delivered" ? "bg-primary/10 text-primary border-primary/20"
      : "bg-amber-500/10 text-amber-500 border-amber-500/20";
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
        {isOverdue && <AlertTriangle className="w-3 h-3" />}
        {isOverdue ? t("متأخر", "Overdue") : status === "paid" ? t("مدفوع", "Paid") : status === "delivered" ? t("تم التسليم", "Delivered") : t("معلق", "Pending")}
      </span>
    );
  };

  const paySupOrders = useMemo(() => {
    if (!paySup) return [];
    return orders.filter(o => o.supplierId === paySup.id && o.status !== "paid");
  }, [paySup, orders]);

  const totalAllocated = useMemo(() => Object.values(payAlloc).reduce((s, v) => s + (v || 0), 0), [payAlloc]);
  const supRemaining = paySup ? paySupOrders.reduce((s, o) => s + orderRemaining(o), 0) : 0;

  // ── Procurement Report ──
  const handleGenerateProcurementReport = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };
  const handleDownloadProcurementPDF = () => {
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const todayStr = new Date().toISOString().split("T")[0];
    const periodLabel = repDateMode === "all" ? t("كل المشتريات", "All Purchases") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;
    const fmtCurrency2 = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
    
    const rptOrders = orders.filter(o => {
      if (repSupId && o.supplierId !== repSupId) return false;
      if (repDateMode === "today" && o.date !== todayStr) return false;
      if (repDateMode === "range") {
        if (repDateFrom && o.date < repDateFrom) return false;
        if (repDateTo && o.date > repDateTo) return false;
      }
      return true;
    });
    const totalOrders = rptOrders.length;
    const totalCost = rptOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const pendingOrders = rptOrders.filter(o => o.status === "pending");
    const completedOrders = rptOrders.filter(o => o.status === "delivered" || o.status === "paid");
    const supStats = suppliers.map(s => ({
      ...s,
      orderCount: rptOrders.filter(o => o.supplierId === s.id).length,
      orderTotal: rptOrders.filter(o => o.supplierId === s.id).reduce((sum, o) => sum + Number(o.total || 0), 0),
    })).filter(s => s.orderCount > 0).sort((a, b) => b.orderTotal - a.orderTotal);
    
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
        <div class="header-right"><h1>${t("تقرير المشتريات", "Procurement Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>📦 ${totalOrders} ${t("أمر شراء", "PO(s)")}</span><span>💰 ${fmtCurrency2(totalCost)}</span></div>
      ${repSummary ? `
      <div class="section"><h2>${t("ملخص المشتريات", "Procurement Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${totalOrders}</div><div class="lbl">${t("أوامر الشراء", "Purchase Orders")}</div></div>
          <div class="card"><div class="num num-green">${completedOrders.length}</div><div class="lbl">${t("مكتمل", "Completed")}</div></div>
          <div class="card"><div class="num num-amber">${pendingOrders.length}</div><div class="lbl">${t("معلق", "Pending")}</div></div>
          <div class="card"><div class="num num-blue">${fmtCurrency2(totalCost)}</div><div class="lbl">${t("إجمالي التكلفة", "Total Cost")}</div></div>
        </div>
      </div>` : ""}
      ${repSuppliers && supStats.length > 0 ? `
      <div class="section"><h2>${t("أداء الموردين", "Supplier Performance")}</h2>
        <table><tr><th>#</th><th>${t("المورد", "Supplier")}</th><th>${t("أوامر الشراء", "POs")}</th><th>${t("الإجمالي", "Total")}</th></tr>
        ${supStats.map((s, i) => `<tr><td>${i + 1}</td><td><strong>${s.name}</strong></td><td>${s.orderCount}</td><td style="font-weight:600">${fmtCurrency2(s.orderTotal)}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      ${repOrders && rptOrders.length > 0 ? `
      <div class="section"><h2>${t("قائمة أوامر الشراء", "Purchase Orders")} (${totalOrders})</h2>
        <table><tr><th>${t("الأمر", "PO")}</th><th>${t("المورد", "Supplier")}</th><th>${t("التاريخ", "Date")}</th><th>${t("الحالة", "Status")}</th><th>${t("الإجمالي", "Total")}</th></tr>
        ${rptOrders.map(o => {
          const sup = suppliers.find(s => s.id === o.supplierId);
          const st = o.status === "delivered" || o.status === "paid" ? `<span class="badge badge-green">${t("مكتمل","Completed")}</span>` : o.status === "pending" ? `<span class="badge badge-amber">${t("معلق","Pending")}</span>` : `<span class="badge badge-blue">${t("قيد التنفيذ","Processing")}</span>`;
          return `<tr><td style="font-weight:600">${o.id}</td><td>${sup?.name || o.supplierId}</td><td>${o.date}</td><td>${st}</td><td style="font-weight:600">${fmtCurrency2(o.total || 0)}</td></tr>`;
        }).join("")}
        </table>
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
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      {/* Header */}
      <motion.div variants={headerVariants} className="relative rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-4 sm:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">{t("المشتريات", "Procurement")}</h1>
              {overdueOrders.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold border border-destructive/20">
                  <AlertTriangle className="w-3 h-3" />
                  {overdueOrders.length} {t("متأخر", "overdue")}
                </div>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("إدارة الموردين وأوامر الشراء", "Manage suppliers, purchase orders & returns")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {tab === "suppliers" && (
              <Button className="w-full sm:w-auto gap-2 rounded-xl" onClick={() => { setSupOpen(true); setSupEditId(null); setSupName(""); setSupPhone(""); setSupCode(""); setSupAddr(""); setSupMaterial(""); }}>
                <UserPlus className="w-4 h-4" />{t("مورد جديد", "New Supplier")}
              </Button>
            )}
            {tab === "orders" && (
              <Button className="w-full sm:w-auto gap-2 rounded-xl group" onClick={() => setPoOpen(true)}>
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />{t("أمر شراء جديد", "New PO")}
              </Button>
            )}
            {tab === "returns" && (
              <Button className="w-full sm:w-auto gap-2 rounded-xl" onClick={() => setRetOpen(true)}>
                <RotateCcw className="w-4 h-4" />{t("تسجيل مرتجع", "Record Return")}
              </Button>
            )}
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setRepOpen(true)}>
              <BarChart3 className="w-4 h-4" />{t("تقرير", "Report")}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Overdue banner */}
      {overdueOrders.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">
            {t("هناك", "There are")} <strong>{overdueOrders.length}</strong> {t("أمر شراء متأخرة عن السداد", "overdue purchase orders")}
          </span>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="relative flex gap-1 p-1 bg-muted/40 border border-border/50 rounded-xl w-fit flex-wrap">
        {[
          { id: "orders" as ProcTab, label: t("أوامر الشراء", "POs"), icon: <FileText className="w-3.5 h-3.5" /> },
          { id: "returns" as ProcTab, label: t("مردود المشتريات", "Returns"), icon: <RotateCcw className="w-3.5 h-3.5" /> },
          { id: "suppliers" as ProcTab, label: t("الموردين", "Suppliers"), icon: <Store className="w-3.5 h-3.5" /> },
        ].map(tabItem => (
          <button key={tabItem.id} onClick={() => { setTab(tabItem.id); setSearchQ(""); }}
            className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${tab === tabItem.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === tabItem.id && (
              <motion.span layoutId="procTab" className="absolute inset-0 bg-background shadow rounded-lg"
                transition={{ type: "spring", stiffness: 300, damping: 25 }} />
            )}
            <span className="relative z-[1] flex items-center gap-2">{tabItem.icon}{tabItem.label}</span>
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {tab === "suppliers" ? (
          <>
            <Card className="p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Store className="w-4 h-4" /></div>
              <div><p className="text-[10px] text-muted-foreground">{t("إجمالي الموردين", "Total Suppliers")}</p><p className="text-sm font-bold">{fmtNum(filteredSuppliers.length)}</p></div>
            </Card>
            <Card className="p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0"><DollarSign className="w-4 h-4" /></div>
              <div><p className="text-[10px] text-muted-foreground">{t("ديون الموردين", "Supplier Debt")}</p><p className="text-sm font-bold text-destructive">{fmtCurrency(stats.supDebt)}</p></div>
            </Card>
          </>
        ) : (
          <>
            <Card className="p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><FileText className="w-4 h-4" /></div>
              <div><p className="text-[10px] text-muted-foreground">{tab === "orders" ? t("إجمالي الأوامر", "Total POs") : t("إجمالي المرتجعات", "Total Returns")}</p><p className="text-sm font-bold">{fmtNum(stats.total)}</p></div>
            </Card>
            <Card className="p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><DollarSign className="w-4 h-4" /></div>
              <div><p className="text-[10px] text-muted-foreground">{t("القيمة", "Value")}</p><p className="text-sm font-bold">{fmtCurrency(stats.value)}</p></div>
            </Card>
            {tab === "orders" && (
              <>
                <Card className="p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"><Clock className="w-4 h-4" /></div>
                  <div><p className="text-[10px] text-muted-foreground">{t("معلق", "Pending")}</p><p className="text-sm font-bold">{fmtNum(stats.pending)}</p></div>
                </Card>
                <Card className="p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4" /></div>
                  <div><p className="text-[10px] text-muted-foreground">{t("متأخر", "Overdue")}</p><p className="text-sm font-bold text-destructive">{fmtNum(stats.overdue)}</p></div>
                </Card>
              </>
            )}
          </>
        )}
      </div>

      {/* Search & Filters (orders/returns) */}
      {tab !== "suppliers" && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2 sm:space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
            <Input placeholder={t("بحث...", "Search...")} className="h-10 pr-10 text-sm rounded-xl w-full" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground/60 font-medium shrink-0">{t("الحالة:", "Status:")}</span>
            {(["all", "pending", "paid", "delivered"] as const).map(v => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${filterStatus === v ? "bg-primary/10 text-primary shadow-sm border border-primary/20" : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 border border-transparent"}`}>
                {v === "all" ? t("الكل", "All") : v === "pending" ? t("معلق", "Pending") : v === "paid" ? t("مدفوع", "Paid") : t("تم التسليم", "Delivered")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "today", "custom"] as const).map(mode => (
              <button key={mode} onClick={() => { setDateMode(mode); if (mode !== "custom") { setDateFrom(""); setDateTo(""); } }}
                className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dateMode === mode ? "bg-primary/10 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground border border-transparent"}`}>
                {mode === "all" ? t("الكل", "All") : mode === "today" ? t("اليوم", "Today") : t("مخصص", "Custom")}
              </button>
            ))}
            {dateMode === "custom" && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 w-full sm:w-[130px] text-xs rounded-lg" />
                <span className="text-[10px] text-muted-foreground">—</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 w-full sm:w-[130px] text-xs rounded-lg" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUPPLIERS TAB ── */}
      {tab === "suppliers" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
            <Input placeholder={t("ابحث عن مورد...", "Search supplier...")} className="h-10 pr-10 text-sm rounded-xl w-full" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            {filteredSuppliers.map(s => {
              const supOrders = orders.filter(o => o.supplierId === s.id);
              const supOverdue = supOrders.filter(o => o.dueDate && o.dueDate < todayStr && o.status !== "paid").length;
              return (
                <motion.div key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-card p-3 sm:p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        {s.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{s.name}</h3>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <Hash className="w-3 h-3"/>{s.code}
                          {s.phone && <><span className="opacity-30">|</span><Phone className="w-3 h-3"/>{s.phone}</>}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{s.material}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setSupEditId(s.id); setSupName(s.name); setSupPhone(s.phone || ""); setSupCode(s.code); setSupAddr(s.address || ""); setSupMaterial(s.material || ""); setSupOpen(true); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        <Edit3 className="w-3.5 h-3.5"/>
                      </button>
                      <button onClick={() => {
                        const hasOrders = orders.some(o => o.supplierId === s.id);
                        if (hasOrders) setDeleteBlockedName(s.name);
                        else deleteSupplier(s.id);
                      }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/40">
                    <div className="flex-1">
                      <p className="text-[9px] text-muted-foreground">{t("المديونية", "Debt")}</p>
                      <p className={`text-sm font-bold ${s.outstandingDebt > 0 ? "text-destructive" : "text-emerald-500"}`}>
                        {s.outstandingDebt > 0 ? fmtCurrency(s.outstandingDebt) : t("—", "—")}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] text-muted-foreground">{t("الأوامر", "Orders")}</p>
                      <p className="text-sm font-bold">{supOrders.length}</p>
                    </div>
                    <div>
                      {s.outstandingDebt > 0 && (
                        <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1 rounded-lg" onClick={() => { setPaySup(s); setPayOpen(true); }}>
                          <HandCoins className="w-3 h-3"/>{t("دفع", "Pay")}
                        </Button>
                      )}
                      {supOverdue > 0 && (
                        <span className="flex items-center gap-1 text-[9px] text-destructive mt-1"><AlertTriangle className="w-3 h-3"/>{supOverdue} {t("متأخر", "overdue")}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ORDERS TAB ── */}
      {tab === "orders" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="text-xs text-muted-foreground bg-gradient-to-r from-muted/80 via-muted/40 to-muted/80">
                  {[
                    { key: "id", label: t("رقم الأمر", "PO#") },
                    { key: "supplierName", label: t("المورد", "Supplier") },
                    { key: null, label: t("الخامة", "Material") },
                    { key: "total", label: t("الإجمالي", "Total") },
                    { key: null, label: t("المدفوع", "Paid") },
                    { key: "status", label: t("الحالة", "Status") },
                    { key: "date", label: t("التاريخ", "Date") },
                    { key: null, label: t("إجراءات", "Actions"), center: true },
                  ].map((col, i) => (
                    <th key={col.key || `ord-col-${i}`} onClick={() => col.key && setSortDir(prev => { setSortField(col.key); return prev === "asc" ? "desc" : "asc"; })}
                      className={`px-4 py-3 font-medium select-none ${col.center ? "text-center" : "text-start"} ${col.key ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}>
                      <span className="flex items-center gap-1">{col.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={8}><div className="flex flex-col items-center py-16 text-muted-foreground"><ShoppingBag className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm">{t("لا توجد أوامر", "No orders")}</p></div></td></tr>
                ) : filteredOrders.map(o => {
                  const isOverdue = o.status !== "paid" && o.dueDate && o.dueDate < todayStr;
                  return (
                    <tr key={o.id} className={`border-b border-border/60 transition-colors hover:bg-muted/10 border-l-[3px] ${isOverdue ? "border-l-destructive" : o.status === "paid" ? "border-l-emerald-500" : o.status === "pending" ? "border-l-amber-500" : "border-l-primary"}`}>
                      <td className="px-4 py-3 font-medium text-primary text-xs">{o.id}</td>
                      <td className="px-4 py-3 font-semibold text-sm">{o.supplierName}</td>
                      <td className="px-4 py-3 text-sm">{o.items.map(i => `${i.material} (${fmtNum(i.qty)} ${i.unit})`).join(", ")}</td>
                      <td className="px-4 py-3 font-bold text-sm">{fmtCurrency(o.total)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={o.paidAmount ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                          {o.paidAmount ? fmtCurrency(o.paidAmount) : t("—", "—")}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} dueDate={o.dueDate} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{fmtDate(o.date)}</div>
                        {o.dueDate && <div className="text-[9px] mt-0.5">{t("مستحق", "Due")}: {fmtDate(o.dueDate)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => {
                            setPoEditId(o.id);
                            setPoSupplierId(o.supplierId);
                            setPoItems(o.items.map(i => ({ material: i.material, qty: String(i.qty), unit: i.unit === "bag" ? "شيكارة" : i.unit === "kg" ? "كجم" : "طن", price: String(i.unitPrice) })));
                            setPoIsCredit(o.paidAmount < o.total);
                            if (o.dueDate) setPoDueDate(o.dueDate);
                            if (o.payMethod) setPoPayMethod(o.payMethod as any);
                            if (o.payBank) setPoPayBank(o.payBank);
                            setPoNotes(o.notes || "");
                            setPoOpen(true);
                          }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-500/5 transition-colors" title={t("تعديل", "Edit")}>
                            <Edit3 className="w-3.5 h-3.5"/>
                          </button>
                          <button onClick={() => setConfirmDeleteId(o.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" title={t("حذف", "Delete")}>
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                          {o.status !== "paid" && (
                            <button onClick={() => { const sup = suppliers.find(s => s.id === o.supplierId); if (sup) { setPaySup(sup); setPayOpen(true); } }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/5 transition-colors" title={t("دفع", "Pay")}>
                              <HandCoins className="w-3.5 h-3.5"/>
                            </button>
                          )}
                          <button onClick={() => { setRetSelectedSup(o.supplierId); setRetSearch(o.supplierName); setRetPoId(o.id); setRetOpen(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-orange-500 hover:bg-orange-500/5 transition-colors" title={t("مرتجع", "Return")}>
                            <RotateCcw className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredOrders.length > 0 && (
                <tfoot><tr className="border-t-2 border-border bg-muted/20"><td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground font-medium">{t("الإجمالي العام", "Grand Total")}</td><td className="px-4 py-3 font-bold text-sm text-primary">{fmtCurrency(filteredOrders.reduce((s, o) => s + Number(o.total || 0), 0))}</td><td colSpan={4} /></tr></tfoot>
              )}
            </table>
          </div>
          {/* Mobile order cards */}
          <div className="sm:hidden p-3 space-y-2">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground"><ShoppingBag className="w-10 h-10 mb-2 opacity-20" /><p className="text-xs">{t("لا توجد أوامر", "No orders")}</p></div>
            ) : filteredOrders.map(o => {
              const isOverdue = o.status !== "paid" && o.dueDate && o.dueDate < todayStr;
              return (
                <Card key={o.id} className={`p-3 space-y-2 border-r-[3px] ${isOverdue ? "border-r-destructive" : o.status === "paid" ? "border-r-emerald-500" : o.status === "pending" ? "border-r-amber-500" : "border-r-primary"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{o.id}</span>
                    <StatusBadge status={o.status} dueDate={o.dueDate} />
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("المورد", "Supplier")}:</span>
                      <span className="font-semibold">{o.supplierName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("الإجمالي", "Total")}:</span>
                      <span className="font-bold">{fmtCurrency(o.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("المدفوع", "Paid")}:</span>
                      <span className={o.paidAmount ? "text-emerald-500 font-medium" : "text-muted-foreground"}>{o.paidAmount ? fmtCurrency(o.paidAmount) : t("—", "—")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("التاريخ", "Date")}:</span>
                      <span>{fmtDate(o.date)}{o.dueDate ? ` (${t("مستحق", "Due")}: ${fmtDate(o.dueDate)})` : ""}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1.5 border-t border-border/20">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] gap-1" onClick={() => {
                      setPoEditId(o.id);
                      setPoSupplierId(o.supplierId);
                      setPoItems(o.items.map(i => ({ material: i.material, qty: String(i.qty), unit: i.unit === "bag" ? "شيكارة" : i.unit === "kg" ? "كجم" : "طن", price: String(i.unitPrice) })));
                      setPoIsCredit(o.paidAmount < o.total);
                      if (o.dueDate) setPoDueDate(o.dueDate);
                      if (o.payMethod) setPoPayMethod(o.payMethod as any);
                      if (o.payBank) setPoPayBank(o.payBank);
                      setPoNotes(o.notes || "");
                      setPoOpen(true);
                    }}>
                      <Edit3 className="w-3 h-3"/>{t("تعديل", "Edit")}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(o.id)}>
                      <Trash2 className="w-3 h-3"/>{t("حذف", "Delete")}
                    </Button>
                    {o.status !== "paid" && (
                      <>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] gap-1" onClick={() => { const sup = suppliers.find(s => s.id === o.supplierId); if (sup) { setPaySup(sup); setPayOpen(true); } }}>
                          <HandCoins className="w-3 h-3"/>{t("دفع", "Pay")}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] gap-1" onClick={() => { setRetSelectedSup(o.supplierId); setRetSearch(o.supplierName); setRetPoId(o.id); setRetOpen(true); }}>
                          <RotateCcw className="w-3 h-3"/>{t("مرتجع", "Return")}
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RETURNS TAB ── */}
      {tab === "returns" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="text-xs text-muted-foreground bg-gradient-to-r from-muted/80 via-muted/40 to-muted/80">
                  {[{ key: "id", label: t("رقم المرتجع", "Return#") }, { key: null, label: t("المورد", "Supplier") }, { key: null, label: t("الخامة", "Material") }, { key: null, label: t("الكمية", "Qty") }, { key: null, label: t("الإجمالي", "Total") }, { key: "date", label: t("التاريخ", "Date") }, { key: null, label: t("السبب", "Reason") }].map((col, i) => (
                    <th key={col.key || `ret-col-${i}`} className={`px-4 py-3 font-medium select-none text-start`}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReturns.length === 0 ? (
                  <tr><td colSpan={7}><div className="flex flex-col items-center py-16 text-muted-foreground"><RotateCcw className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm">{t("لا توجد مرتجعات", "No returns")}</p></div></td></tr>
                ) : filteredReturns.map(r => (
                  <tr key={r.id} className="border-b border-border/60 transition-colors hover:bg-muted/10 border-l-[3px] border-l-orange-400">
                    <td className="px-4 py-3 font-medium text-orange-500 text-xs">{r.id}</td>
                    <td className="px-4 py-3 font-semibold text-sm">{r.supplierName}</td>
                    <td className="px-4 py-3 text-sm">{r.items.map(i => i.material).join(", ")}</td>
                    <td className="px-4 py-3 text-sm">{r.items.map(i => `${fmtNum(i.qty)} ${i.unit}`).join(", ")}</td>
                    <td className="px-4 py-3 font-bold text-sm">{fmtCurrency(r.total)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{r.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile return cards */}
          <div className="sm:hidden p-3 space-y-2">
            {filteredReturns.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground"><RotateCcw className="w-10 h-10 mb-2 opacity-20" /><p className="text-xs">{t("لا توجد مرتجعات", "No returns")}</p></div>
            ) : filteredReturns.map(r => (
              <Card key={r.id} className="p-3 space-y-1 border-r-[3px] border-r-orange-400">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-500">{r.id}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(r.date)}</span>
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("المورد", "Supplier")}:</span><span className="font-semibold">{r.supplierName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("الخامة", "Material")}:</span><span>{r.items.map(i => i.material).join(", ")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("الإجمالي", "Total")}:</span><span className="font-bold">{fmtCurrency(r.total)}</span></div>
                  {r.reason && <div className="flex justify-between"><span className="text-muted-foreground">{t("السبب", "Reason")}:</span><span className="truncate max-w-[180px]">{r.reason}</span></div>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── NEW PO SHEET ── */}
      <Sheet open={poOpen} onOpenChange={v => { setPoOpen(v); if (!v) { setPoDone(false); setPoEditId(null); setPoIsCredit(false); setPoDueDate(""); setPoPayMethod("cash"); setPoPayBank(""); } }}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{poEditId ? t("تعديل أمر الشراء", "Edit Purchase Order") : t("أمر شراء جديد", "New Purchase Order")}</SheetTitle>
            <SheetDescription>{t("إنشاء أمر شراء مع خيار الدفع نقداً أو آجل", "Create PO with cash or credit payment")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("المورد", "Supplier")}</Label>
              <div className="flex gap-2">
                <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                  <SelectTrigger className="h-11 rounded-xl flex-1"><SelectValue placeholder={t("اختر المورد", "Select supplier")} /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0"
                  onClick={() => setPoShowAddSup(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {poShowAddSup && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/40 mt-2">
                  <SmartInput value={poNewSupName} onChange={setPoNewSupName} extraSuggestions={suppliers.map(s => s.name)} placeholder={t("اسم المورد", "Supplier name")} className="h-9 text-sm rounded-lg flex-1" />
                  <Input className="h-9 text-sm rounded-lg w-[130px]" placeholder={t("الهاتف", "Phone")} value={poNewSupPhone} onChange={e => setPoNewSupPhone(e.target.value)} />
                  <Button size="sm" className="h-9 rounded-lg shrink-0"
                    onClick={() => {
                      if (!poNewSupName.trim()) return;
                      const supId = `SUP-${Date.now()}`;
                      addSupplier({ name: poNewSupName.trim(), phone: poNewSupPhone.trim(), code: supId, address: "", material: "", outstandingDebt: 0, status: "active" });
                      setPoSupplierId(supId);
                      setPoShowAddSup(false);
                      setPoNewSupName("");
                      setPoNewSupPhone("");
                    }}>
                    {t("إضافة", "Add")}
                  </Button>
                </div>
              )}
            </div>

            {/* Supplier unpaid orders info */}
            {poSupplierId && poSupplierOrders.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-600 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0"/>
                {t("للمورد", "Supplier has")} <strong>{poSupplierOrders.length}</strong> {t("أوامر غير مدفوعة بإجمالي", "unpaid orders totaling")} {fmtCurrency(poSupplierOrders.reduce((s, o) => s + orderRemaining(o), 0))}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{t("الخامات", "Items")}</Label>
                <div className="flex gap-1">
                  {poShowAddMat ? (
                    <div className="flex items-center gap-1">
                      <Input className="h-7 w-[130px] text-xs rounded-lg" placeholder={t("اسم الخامة", "Material name")} value={poNewMatName} onChange={e => setPoNewMatName(e.target.value)} />
                      <Button type="button" size="sm" className="h-7 text-[10px] gap-1 rounded-lg"
                        onClick={() => {
                          if (!poNewMatName.trim()) return;
                          setMaterialsList(prev => [...prev, poNewMatName.trim()]);
                          setPoNewMatName("");
                          setPoShowAddMat(false);
                        }}>
                        {t("إضافة", "Add")}
                      </Button>
                      <button type="button" onClick={() => { setPoShowAddMat(false); setPoNewMatName(""); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] gap-1 rounded-lg"
                      onClick={() => setPoShowAddMat(true)}>
                      <Plus className="w-3 h-3"/>{t("خامة جديدة", "New Material")}
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] gap-1 rounded-lg"
                    onClick={addPoItem}>
                    <Plus className="w-3 h-3"/>{t("إضافة صنف", "Add Item")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {poItems.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground">{t("صنف", "Item")} {idx + 1}</span>
                      {poItems.length > 1 && (
                        <button type="button" onClick={() => removePoItem(idx)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <SmartInput
                      value={item.material}
                      onChange={v => updatePoItem(idx, "material", v)}
                      extraSuggestions={materialsList}
                      placeholder={t("اختر الخامة", "Select material")}
                      className="h-10 rounded-lg text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1 space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground">{t("الكمية", "Qty")}</Label>
                        <Input type="number" min="0" className="h-10 text-base font-bold text-center rounded-lg" placeholder="0" value={item.qty} onChange={e => updatePoItem(idx, "qty", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground">{t("الوحدة", "Unit")}</Label>
                        <Select value={item.unit} onValueChange={v => updatePoItem(idx, "unit", v)}>
                          <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground">{t("السعر", "Price")}</Label>
                        <Input type="number" min="0" className="h-10 text-base font-bold text-center rounded-lg" placeholder="0" value={item.price} onChange={e => updatePoItem(idx, "price", e.target.value)} />
                      </div>
                    </div>
                    {(parseFloat(item.qty) || 0) > 0 && (parseFloat(item.price) || 0) > 0 && (
                      <div className="text-[10px] text-muted-foreground text-end">
                        {t("المجموع", "Subtotal")}: <span className="font-bold text-foreground">{fmtCurrency((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0))}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Warehouse selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("المخزن", "Warehouse")}</Label>
              <div className="flex gap-2">
                <Select value={poWarehouse} onValueChange={setPoWarehouse}>
                  <SelectTrigger className="h-11 rounded-xl flex-1">
                    <SelectValue placeholder={t("اختر المخزن", "Select warehouse")} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseConfigs.map(w => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0"
                  onClick={() => setPoShowAddWh(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0"
                  onClick={() => setPoWhManageOpen(true)}>
                  <Settings2 className="w-4 h-4" />
                </Button>
              </div>
              {poShowAddWh && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/40">
                  <Input className="h-9 text-sm rounded-lg flex-1" placeholder={t("اسم المخزن", "Warehouse name")} value={poNewWhName} onChange={e => setPoNewWhName(e.target.value)} />
                  <Button size="sm" className="h-9 rounded-lg shrink-0"
                    onClick={async () => {
                      if (!poNewWhName.trim()) return;
                      const whId = `WH-${Date.now()}`;
                      const created = await addWarehouseConfig({ id: whId, name: poNewWhName.trim(), normalThreshold: 50, warningThreshold: 20 });
                      if (created) {
                        setPoWarehouse(whId);
                        setPoShowAddWh(false);
                        setPoNewWhName("");
                      }
                    }}>
                    {t("إضافة", "Add")}
                  </Button>
                </div>
              )}
            </div>

            {/* Warehouse Management Dialog */}
            <Dialog open={poWhManageOpen} onOpenChange={setPoWhManageOpen}>
              <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <Settings2 className="w-4 h-4 text-primary"/>
                    {t("إدارة المخازن", "Warehouse Management")}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {warehouseConfigs.map(w => (
                    <div key={w.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50">
                      {poEditWhId === w.id ? (
                        <>
                          <Input value={poEditWhName} onChange={e => setPoEditWhName(e.target.value)} className="h-8 text-sm flex-1" autoFocus />
                          <Button size="sm" className="h-8 text-xs" onClick={() => { updateWarehouseConfig(w.id, { name: poEditWhName }); setPoEditWhId(null); }}>
                            {t("حفظ", "Save")}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPoEditWhId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{w.name}</span>
                          <button type="button" onClick={() => { setPoEditWhId(w.id); setPoEditWhName(w.name); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => { deleteWarehouseConfig(w.id); if (poWarehouse === w.id) setPoWarehouse(""); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {warehouseConfigs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("لا توجد مخازن", "No warehouses")}</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Payment type toggle */}
            <div className="flex gap-2 p-1 rounded-xl bg-muted/50 border border-border/30">
              <button type="button" onClick={() => setPoIsCredit(false)}
                className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all ${!poIsCredit ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                <Banknote className="w-3.5 h-3.5 inline mr-1"/>{t("نقداً", "Cash")}
              </button>
              <button type="button" onClick={() => setPoIsCredit(true)}
                className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all ${poIsCredit ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                <CalendarDays className="w-3.5 h-3.5 inline mr-1"/>{t("آجل", "Credit")}
              </button>
            </div>

            {poIsCredit ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("تاريخ الاستحقاق", "Due Date")}</Label>
                <Input type="date" value={poDueDate} onChange={e => setPoDueDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            ) : (
              <>
                {/* Payment method */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("طريقة الدفع", "Payment Method")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "cash", label: t("نقدي", "Cash"), cls: "border-emerald-500 bg-emerald-500/5 text-emerald-600" },
                      { id: "bank_transfer", label: t("تحويل بنكي", "Bank Transfer"), cls: "border-blue-500 bg-blue-500/5 text-blue-600" },
                      { id: "vodafone_cash", label: t("فودافون كاش", "Vodafone Cash"), cls: "border-orange-500 bg-orange-500/5 text-orange-600" },
                      { id: "instapay", label: t("انستا باي", "InstaPay"), cls: "border-purple-500 bg-purple-500/5 text-purple-600" },
                    ].map(m => (
                      <button key={m.id} type="button" onClick={() => { setPoPayMethod(m.id as any); setPoPayBank(""); }}
                        className={`flex items-center justify-center gap-2 h-9 rounded-lg border text-xs font-medium transition-all ${poPayMethod === m.id ? m.cls + " shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                        {m.id === "cash" ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {poPayMethod !== "cash" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {poPayMethod === "bank_transfer" ? t("البنك", "Bank") : poPayMethod === "vodafone_cash" ? t("محفظة فودافون", "Vodafone Wallet") : t("حساب انستا باي", "InstaPay Account")}
                    </Label>
                    <Select value={poPayBank} onValueChange={setPoPayBank}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={t("اختر", "Select")} /></SelectTrigger>
                      <SelectContent>
                        {poPayMethod === "bank_transfer" && bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({fmtNum(b.balance)})</SelectItem>)}
                        {(poPayMethod === "vodafone_cash" || poPayMethod === "instapay") && walletAccounts.filter(w => w.type === poPayMethod).map(w => <SelectItem key={w.id} value={w.id}>{w.name} — {w.identifier}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("ملاحظات", "Notes")} <span className="text-muted-foreground/50">{t("(اختياري)", "(optional)")}</span></Label>
              <Input className="h-11 rounded-xl" value={poNotes} onChange={e => setPoNotes(e.target.value)} placeholder={t("ملاحظة...", "Note...")} />
            </div>

            {poTotal > 0 && (
              <div className="p-4 bg-muted/30 rounded-xl flex justify-between items-center">
                <span className="font-medium text-sm">{t("إجمالي الأمر", "Order Total")}</span>
                <span className="text-xl font-bold text-primary">{fmtCurrency(poTotal)}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {poDone ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-bold">{t("تم إنشاء الأمر!", "PO created!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex gap-3 pt-1">
                  <Button className="flex-1 h-11 rounded-xl text-sm font-bold" onClick={handleSubmitPO} disabled={!poSupplierId || poItems.length === 0 || poItems.some(item => !item.material || !item.qty || !item.price) || (poIsCredit && !poDueDate) || (!poIsCredit && poPayMethod !== "cash" && !poPayBank)}>
                    {poEditId ? t("حفظ التعديلات", "Save Changes") : poIsCredit ? t("إنشاء أمر آجل", "Create Credit PO") : t("إنشاء الأمر", "Create PO")}
                  </Button>
                  <Button variant="outline" className="h-11 rounded-xl px-6" onClick={() => setPoOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── RETURN SHEET ── */}
      <Sheet open={retOpen} onOpenChange={v => { if (!v) { setRetOpen(false); setRetPoId(""); setRetSearch(""); setRetSelectedSup(null); setRetItems([{ material: "", qty: "", unit: "طن", price: "" }]); setRetShowAddMat(false); setRetNewMatName(""); setRetReason(""); } }}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("تسجيل مردود مشتريات", "Record Purchase Return")}</SheetTitle>
            <SheetDescription>{t("إرجاع خامات للمورد وخصمها من المخزون", "Return materials to supplier")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4">

            {/* Supplier search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("المورد", "Supplier")}</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                <Input className="h-11 pr-10 text-sm rounded-xl" placeholder={t("ابحث بالاسم أو الهاتف أو الكود", "Search by name, phone or code")} value={retSearch} onChange={e => { setRetSearch(e.target.value); setRetSelectedSup(null); setRetPoId(""); }} />
              </div>
              {retSearch && !retSelectedSup && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 bg-card mt-1">
                  {suppliers.filter(s => s.name.toLowerCase().includes(retSearch.toLowerCase()) || s.phone.includes(retSearch) || s.code.toLowerCase().includes(retSearch.toLowerCase())).map(s => (
                    <button key={s.id} type="button" onClick={() => { setRetSelectedSup(s.id); setRetSearch(s.name); }}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground block">{s.code} {s.phone ? `| ${s.phone}` : ""}</span>
                    </button>
                  ))}
                  {suppliers.filter(s => s.name.toLowerCase().includes(retSearch.toLowerCase()) || s.phone.includes(retSearch) || s.code.toLowerCase().includes(retSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">{t("لا توجد نتائج", "No results")}</div>
                  )}
                </div>
              )}
            </div>

            {/* PO select */}
            {retSelectedSup && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("أمر الشراء", "Purchase Order")}</Label>
                <Select value={retPoId} onValueChange={v => { setRetPoId(v); }}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={t("اختر أمر الشراء", "Select PO")} /></SelectTrigger>
                  <SelectContent>
                    {orders.filter(o => o.supplierId === retSelectedSup).map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.id} — {fmtCurrency(o.total)} ({o.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {orders.filter(o => o.supplierId === retSelectedSup).length === 0 && (
                  <p className="text-[10px] text-muted-foreground">{t("لا توجد أوامر شراء لهذا المورد", "No POs for this supplier")}</p>
                )}
              </div>
            )}

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{t("الخامات", "Items")}</Label>
                <div className="flex gap-1">
                  {retShowAddMat ? (
                    <div className="flex items-center gap-1">
                      <Input className="h-7 w-[130px] text-xs rounded-lg" placeholder={t("اسم الخامة", "Material name")} value={retNewMatName} onChange={e => setRetNewMatName(e.target.value)} />
                      <Button type="button" size="sm" className="h-7 text-[10px] gap-1 rounded-lg"
                        onClick={() => {
                          if (!retNewMatName.trim()) return;
                          setMaterialsList(prev => [...prev, retNewMatName.trim()]);
                          setRetNewMatName("");
                          setRetShowAddMat(false);
                        }}>
                        {t("إضافة", "Add")}
                      </Button>
                      <button type="button" onClick={() => { setRetShowAddMat(false); setRetNewMatName(""); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] gap-1 rounded-lg"
                      onClick={() => setRetShowAddMat(true)}>
                      <Plus className="w-3 h-3"/>{t("خامة جديدة", "New Material")}
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] gap-1 rounded-lg"
                    onClick={addRetItem}>
                    <Plus className="w-3 h-3"/>{t("إضافة صنف", "Add Item")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {retItems.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground">{t("صنف", "Item")} {idx + 1}</span>
                      {retItems.length > 1 && (
                        <button type="button" onClick={() => removeRetItem(idx)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <SmartInput
                      value={item.material}
                      onChange={v => updateRetItem(idx, "material", v)}
                      extraSuggestions={materialsList}
                      placeholder={t("اختر الخامة", "Select material")}
                      className="h-10 rounded-lg text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1 space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground">{t("الكمية", "Qty")}</Label>
                        <Input type="number" min="0" className="h-10 text-base font-bold text-center rounded-lg" placeholder="0" value={item.qty} onChange={e => updateRetItem(idx, "qty", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground">{t("الوحدة", "Unit")}</Label>
                        <Select value={item.unit} onValueChange={v => updateRetItem(idx, "unit", v)}>
                          <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground">{t("السعر", "Price")}</Label>
                        <Input type="number" min="0" className="h-10 text-base font-bold text-center rounded-lg" placeholder="0" value={item.price} onChange={e => updateRetItem(idx, "price", e.target.value)} />
                      </div>
                    </div>
                    {(parseFloat(item.qty) || 0) > 0 && (parseFloat(item.price) || 0) > 0 && (
                      <div className="text-[10px] text-muted-foreground text-end">
                        {t("المجموع", "Subtotal")}: <span className="font-bold text-foreground">{fmtCurrency((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0))}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("سبب الإرجاع", "Reason")}</Label>
              <Input className="h-11 rounded-xl" value={retReason} onChange={e => setRetReason(e.target.value)} placeholder={t("اختياري", "Optional")} />
            </div>
            {retTotal > 0 && (
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl flex justify-between items-center">
                <span className="font-medium text-sm">{t("إجمالي المرتجع", "Return Total")}</span>
                <span className="text-xl font-bold text-orange-600">{fmtCurrency(retTotal)}</span>
              </div>
            )}
            <Button className="w-full h-11 rounded-xl gap-2" onClick={handleSubmitReturn} disabled={!retPoId || retItems.length === 0 || retItems.some(item => !item.material || !item.qty || !item.price)}>
              <RotateCcw className="w-4 h-4" />{t("تسجيل المرتجع", "Record Return")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── SUPPLIER FORM DIALOG ── */}
      <Dialog open={supOpen} onOpenChange={v => { if (!v) { setSupOpen(false); setSupEditId(null); } }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{supEditId ? t("تعديل المورد", "Edit Supplier") : t("مورد جديد", "New Supplier")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("الاسم", "Name")}</Label>
              <SmartInput value={supName} onChange={setSupName} extraSuggestions={suppliers.map(s => s.name)} placeholder={t("اسم المورد", "Supplier name")} className="h-11 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("الهاتف", "Phone")}</Label>
                <Input value={supPhone} onChange={e => setSupPhone(e.target.value)} className="h-11 rounded-xl" placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("الكود", "Code")}</Label>
                <Input value={supCode} onChange={e => setSupCode(e.target.value)} className="h-11 rounded-xl" placeholder={t("كود المورد", "SUP-XXX")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("العنوان", "Address")}</Label>
              <SmartInput value={supAddr} onChange={setSupAddr} extraSuggestions={[...new Set(suppliers.filter(s => s.address).map(s => s.address!))]} placeholder={t("العنوان", "Address")} className="h-11 rounded-xl" showSuggestion={false} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("الخامة الأساسية", "Main Material")}</Label>
              <SmartInput
                value={supMaterial}
                onChange={setSupMaterial}
                extraSuggestions={materialsList}
                placeholder={t("اختر الخامة", "Select material")}
                className="h-11 rounded-xl"
              />
            </div>
            <Button className="w-full h-11 rounded-xl" onClick={handleSaveSupplier} disabled={!supName.trim()}>
              {supEditId ? t("حفظ التعديلات", "Save Changes") : t("إضافة المورد", "Add Supplier")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PAYMENT DIALOG ── */}
      <Dialog open={payOpen} onOpenChange={v => { if (!v) { setPayOpen(false); setPaySup(null); setPayAmount(""); setPayAlloc({}); } }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-lg max-h-[90vh] overflow-y-auto !p-0">
          <div className="bg-gradient-to-b from-emerald-500/[0.07] to-transparent px-6 pt-6 pb-4 rounded-t-2xl border-b border-border/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500"><HandCoins className="w-5 h-5"/>{t("تسديد دفعة للمورد", "Supplier Payment")}</DialogTitle>
            </DialogHeader>
          </div>
          {paySup && (
            <div className="px-6 pb-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  {paySup.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold">{paySup.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t("اجمالي المديونية", "Total Debt")}: {fmtCurrency(paySup.outstandingDebt)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("المبلغ (ج.م)", "Amount (EGP)")}</Label>
                <Input type="number" min="0" value={payAmount} onChange={e => { setPayAmount(e.target.value); setPayAlloc({}); }}
                  className="h-11 text-lg font-bold text-center rounded-xl" placeholder="0" />
              </div>

              {/* Outstanding orders */}
              {paySupOrders.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground">{t("الفواتير المستحقة", "Unpaid Orders")} ({paySupOrders.length})</span>
                    <button type="button" onClick={handleAutoAlloc} disabled={!parseFloat(payAmount) || parseFloat(payAmount) <= 0}
                      className="text-[10px] font-medium text-primary hover:underline disabled:opacity-30 flex items-center gap-1">
                      <ArrowLeftRight className="w-3 h-3"/>{t("توزيع تلقائي", "Auto")}
                    </button>
                  </div>
                  {paySupOrders.map(o => {
                    const remaining = orderRemaining(o);
                    return (
                      <div key={o.id} className="rounded-xl border border-border/40 bg-card p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Receipt className="w-3 h-3 text-muted-foreground/40 shrink-0"/>
                            <span className="text-xs font-semibold">{o.id}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{fmtDate(o.date)}</span>
                          </div>
                          <span className="text-xs font-bold">{fmtNum(remaining)} <span className="text-[9px] text-muted-foreground font-normal">ج.م</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground/50">{t("تخصيص", "Alloc")}:</span>
                          <Input type="number" min="0" step="0.01"
                            className="h-7 flex-1 text-xs text-center rounded-lg border-border/50"
                            placeholder="0" value={payAlloc[o.id] ?? ""}
                            onChange={e => {
                              const num = parseFloat(e.target.value) || 0;
                              setPayAlloc(prev => {
                                const next = { ...prev };
                                const clamped = Math.min(num, remaining);
                                if (clamped <= 0) delete next[o.id];
                                else next[o.id] = clamped;
                                return next;
                              });
                            }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalAllocated > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-3.5 py-2.5">
                  <span className="text-xs font-medium text-emerald-600">{t("سيتم توزيع", "Will allocate")}</span>
                  <span className="font-bold text-emerald-600">{fmtNum(totalAllocated)} ج.م</span>
                </div>
              )}

              {/* Payment method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("طريقة الدفع", "Payment Method")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "cash", label: t("نقدي", "Cash"), cls: "border-emerald-500 bg-emerald-500/5 text-emerald-600" },
                    { id: "bank_transfer", label: t("تحويل بنكي", "Bank Transfer"), cls: "border-blue-500 bg-blue-500/5 text-blue-600" },
                    { id: "vodafone_cash", label: t("فودافون كاش", "Vodafone Cash"), cls: "border-orange-500 bg-orange-500/5 text-orange-600" },
                    { id: "instapay", label: t("انستا باي", "InstaPay"), cls: "border-purple-500 bg-purple-500/5 text-purple-600" },
                  ].map(m => (
                    <button key={m.id} type="button" onClick={() => { setPayMethod(m.id as any); setPayBank(""); }}
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${payMethod === m.id ? m.cls + " shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                      {m.id === "cash" ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {payMethod !== "cash" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {payMethod === "bank_transfer" ? t("البنك", "Bank") : payMethod === "vodafone_cash" ? t("محفظة فودافون", "Vodafone Wallet") : t("حساب انستا باي", "InstaPay Account")}
                  </Label>
                  <Select value={payBank} onValueChange={setPayBank}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={t("اختر", "Select")} /></SelectTrigger>
                    <SelectContent>
                      {payMethod === "bank_transfer" && bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({fmtNum(b.balance)})</SelectItem>)}
                      {(payMethod === "vodafone_cash" || payMethod === "instapay") && walletAccounts.filter(w => w.type === payMethod).map(w => <SelectItem key={w.id} value={w.id}>{w.name} — {w.identifier}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("ملاحظات", "Notes")}</Label>
                <Input className="h-11 rounded-xl" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder={t("ملاحظة...", "Note...")} />
              </div>

              <Button className="w-full h-11 rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handlePaySupplier} disabled={!payAmount || parseFloat(payAmount) <= 0 || totalAllocated <= 0 || (payMethod !== "cash" && !payBank)}>
                <HandCoins className="w-4 h-4" />{t("تأكيد الدفع", "Confirm Payment")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Procurement Report Dialog ── */}
      <Dialog open={repOpen} onOpenChange={setRepOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5 text-primary" />
              {t("تقرير المشتريات", "Procurement Report")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Date filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("نطاق التاريخ", "Date Range")}</Label>
              <div className="flex gap-1.5 flex-wrap">
                {(["all", "today", "range"] as const).map(m => (
                  <button key={m} onClick={() => { setRepDateMode(m); setRepGenerated(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${repDateMode === m ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                    {m === "all" ? t("الكل", "All") : m === "today" ? t("اليوم", "Today") : t("نطاق", "Range")}
                  </button>
                ))}
              </div>
              {repDateMode === "range" && (
                <div className="flex gap-2 items-center">
                  <Input type="date" className="h-9 rounded-lg text-xs" value={repDateFrom} onChange={e => { setRepDateFrom(e.target.value); setRepGenerated(false); }} />
                  <span className="text-xs text-muted-foreground">{t("إلى", "to")}</span>
                  <Input type="date" className="h-9 rounded-lg text-xs" value={repDateTo} onChange={e => { setRepDateTo(e.target.value); setRepGenerated(false); }} />
                </div>
              )}
            </div>

            {/* Supplier filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("المورد (اختياري)", "Supplier (optional)")}</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
                <Input className="h-9 pr-9 text-xs rounded-lg" placeholder={t("ابحث عن مورد...", "Search supplier...")}
                  value={repSupSearch} onChange={e => { setRepSupSearch(e.target.value); setRepSupId(""); setRepGenerated(false); }} />
              </div>
              {repSupSearch && !repSupId && (
                <div className="border border-border/60 rounded-lg max-h-32 overflow-y-auto divide-y">
                  {suppliers.filter(s => s.name.toLowerCase().includes(repSupSearch.toLowerCase())).slice(0, 8).map(s => (
                    <button key={s.id} type="button" onClick={() => { setRepSupId(s.id); setRepSupSearch(s.name); setRepGenerated(false); }}
                      className="w-full text-right px-3 py-2 text-xs hover:bg-muted/40 transition-colors">
                      {s.name}
                    </button>
                  ))}
                  {suppliers.filter(s => s.name.toLowerCase().includes(repSupSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">{t("لا توجد نتائج", "No results")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Include sections */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("الأقسام", "Sections")}</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "repSummary", label: t("ملخص", "Summary"), state: repSummary, set: setRepSummary },
                  { id: "repOrders", label: t("أوامر الشراء", "POs"), state: repOrders, set: setRepOrders },
                  { id: "repSuppliers", label: t("الموردين", "Suppliers"), state: repSuppliers, set: setRepSuppliers },
                ].map(s => (
                  <button key={s.id} onClick={() => { s.set(!s.state); setRepGenerated(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${s.state ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 gap-2 rounded-xl" onClick={handleGenerateProcurementReport} disabled={repGenerating || (repDateMode === "range" && !repDateFrom && !repDateTo)}>
                {repGenerating ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t("جارٍ التحميل...", "Generating...")}</>
                ) : (
                  <><BarChart3 className="w-4 h-4" />{t("إنشاء التقرير", "Generate Report")}</>
                )}
              </Button>
              {repGenerated && (
                <Button variant="outline" className="gap-2 rounded-xl" onClick={handleDownloadProcurementPDF}>
                  <Download className="w-4 h-4" />{t("تنزيل PDF", "Download PDF")}
                </Button>
              )}
            </div>

            {/* Success message */}
            {repGenerated && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {t("تم إنشاء التقرير بنجاح. يمكنك تنزيله بصيغة PDF.", "Report generated successfully. You can download it as PDF.")}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Blocked delete (supplier has orders) */}
      <Dialog open={!!deleteBlockedName} onOpenChange={v => { if (!v) setDeleteBlockedName(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{t("لا يمكن الحذف", "Cannot Delete")}</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {t(
                `لا يمكن حذف المورد "${deleteBlockedName}" لأنه لديه أوامر شراء سابقة.`,
                `Supplier "${deleteBlockedName}" cannot be deleted because they have existing purchase orders.`
              )}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteBlockedName(null)}>{t("حسناً", "OK")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDeleteId} onOpenChange={v => { if (!v) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{t("تأكيد الحذف", "Confirm Delete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("هل أنت متأكد من حذف هذا الأمر؟ لا يمكن التراجع عن هذا الإجراء.", "Are you sure you want to delete this order? This action cannot be undone.")}</p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setConfirmDeleteId(null)}>{t("إلغاء", "Cancel")}</Button>
            <Button variant="destructive" className="flex-1 rounded-xl" onClick={async () => {
              if (confirmDeleteId) {
                await deleteOrder(confirmDeleteId);
                await deleteInventoryItemsBySource(confirmDeleteId);
                setConfirmDeleteId(null);
              }
            }}>{t("حذف", "Delete")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
