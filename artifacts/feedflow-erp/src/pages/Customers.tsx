import React, { useState, useMemo } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useSalesStore, type SalesInvoice, type SalesInvoiceItem } from "@/hooks/use-sales-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { mockData } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import SmartInput from "@/components/SmartInput";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Phone, MapPin, CreditCard, ChevronLeft, CheckCircle2, TrendingUp, Calendar, ShoppingCart, AlertTriangle, Search, X, RotateCcw, FileText, Store, Hash, CalendarDays, Clock, CalendarRange, ArrowLeftRight, Plus, Trash2, Scale, Package, HandCoins, BarChart3, Download } from "lucide-react";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const cardVariants = { hidden: { opacity: 0, y: 12, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 100, damping: 13 } } };

const governorates = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "البحيرة", "الغربية", "الشرقية", "الوادي الجديد", "أسيوط", "سوهاج"];

export default function Customers() {
  const { t, taxPercent, taxEnabled, maxDiscountPercent } = useAppStore();
  const { invoices, returns, payments, customers, addInvoice, addReturn, addCustomer, updateCustomer, deleteCustomer } = useSalesStore();
  const { inventory, updateInventoryItem, addFinishedProduct } = useProductionStore();
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInv, setDetailInv] = useState<SalesInvoice | null>(null);

  // Invoice form
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [formPricing, setFormPricing] = useState("wholesale");
  const [formDiscount, setFormDiscount] = useState("0");
  const [formItems, setFormItems] = useState<SalesInvoiceItem[]>([{ productId: "", productName: "", productCode: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]);

  const products = mockData.products;

  // Search
  const [searchQ, setSearchQ] = useState("");

  // Transaction filters
  const [transDateMode, setTransDateMode] = useState<"all" | "today" | "custom">("all");
  const [transDateFrom, setTransDateFrom] = useState("");
  const [transDateTo, setTransDateTo] = useState("");
  const [transFilterType, setTransFilterType] = useState<string>("all");
  const [transFilterStatus, setTransFilterStatus] = useState<string>("all");

  const todayStr = new Date().toISOString().split("T")[0];

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repSummary, setRepSummary] = useState(true);
  const [repList, setRepList] = useState(true);
  const [repTop, setRepTop] = useState(true);
  const [repSearch, setRepSearch] = useState("");
  const [repCustId, setRepCustId] = useState("");

  // Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(num);

  const filteredCustomers = useMemo(() => {
    if (!searchQ) return customers;
    const q = searchQ.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, searchQ]);

  const customerTransactions = useMemo(() => {
    if (!selectedCustomer) return [];
    const name = selectedCustomer.name;
    const invs = invoices.filter(i => i.customerName === name).map(i => ({
      date: i.date, id: i.id, type: "invoice" as const,
      desc: t(`فاتورة #${i.id}`, `Invoice #${i.id}`),
      amount: i.total, typeLabel: i.type, status: i.status,
    }));
    const rets = returns.filter(r => r.customerName === name).map(r => ({
      date: r.date, id: r.id, type: "return" as const,
      desc: t(`مرتجع #${r.id}`, `Return #${r.id}`),
      amount: -r.total, typeLabel: "return", status: "returned" as const,
    }));
    const pmts = payments.filter(p => p.customerId === selectedCustomer.id).map(p => ({
      date: p.date, id: p.id, type: "payment" as const,
      desc: t(`سند قبض #${p.id.slice(-6)}`, `Receipt #${p.id.slice(-6)}`),
      amount: p.amount, typeLabel: "payment", status: "paid" as const,
    }));
    let combined = [...invs, ...rets, ...pmts].sort((a, b) => b.date.localeCompare(a.date));
    if (transDateMode === "today") combined = combined.filter(t => t.date === todayStr);
    if (transDateMode === "custom") {
      if (transDateFrom) combined = combined.filter(t => t.date >= transDateFrom);
      if (transDateTo) combined = combined.filter(t => t.date <= transDateTo);
    }
    if (transFilterType !== "all") {
      combined = combined.filter(t => t.typeLabel === transFilterType);
    }
    if (transFilterStatus !== "all") {
      combined = combined.filter(t => t.status === transFilterStatus);
    }
    return combined;
  }, [selectedCustomer, invoices, returns, payments, transDateMode, transDateFrom, transDateTo, transFilterType, transFilterStatus, todayStr, t]);

  const handleSubmit = () => {
    if (!name || !phone || !governorate) return;
    const newCustomer = {
      id: `C${Date.now()}`,
      name, phone, phone2: "", code: `CL-${Date.now().toString().slice(-4)}`,
      address, region, governorate,
      distributionCenter: "DC-New",
      totalPurchases: 0,
      lastPurchase: t("لا يوجد", "None"),
      creditLimit: parseFloat(creditLimit) || 0,
      outstandingDebt: 0,
    };
    addCustomer(newCustomer);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setAddOpen(false);
      setName(""); setPhone(""); setAddress(""); setRegion(""); setGovernorate(""); setCreditLimit("");
    }, 1400);
  };

  const handleCreateInvoice = () => {
    if (!selectedCustomer || !formType || formItems.some(i => !i.productId || i.qtyTons <= 0)) return;
    const subtotal = formItems.reduce((s, i) => s + i.qtyTons * i.pricePerTon, 0);
    const discPct = parseFloat(formDiscount) || 0;
    const discAmt = subtotal * discPct / 100;
    const tp = taxEnabled ? taxPercent : 0;
    const ta = tp > 0 ? (subtotal - discAmt) * tp / 100 : 0;
    const total = subtotal - discAmt + ta;
    const inv: SalesInvoice = {
      id: `INV-2025-${Date.now().toString().slice(-4)}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      type: formType as any,
      status: (formStatus || (formType === "cash" ? "paid" : "pending")) as any,
      date: new Date().toISOString().split("T")[0],
      items: formItems.map(i => ({ ...i })),
      discountPct: discPct, discountAmt: discAmt,
      taxPct: tp, taxAmt: ta,
      total, subtotal,
      pricingTier: formType === "credit" ? (formPricing as "wholesale" | "retail") : undefined,
      paidAmount: formType === "cash" ? total : 0,
    };
    addInvoice(inv);
    for (const item of formItems) {
      const match = inventory.find(i => i.type === "finished" && i.materialName === item.productName);
      if (match) {
        const consumed = match.unit === "kg" ? item.qtyTons * 1000 : item.qtyTons;
        const newQty = Math.max(0, +(match.quantity - consumed).toFixed(2));
        const newConsumed = +(match.consumedQuantity + consumed).toFixed(2);
        updateInventoryItem(match.id, { quantity: newQty, consumedQuantity: newConsumed });
      } else {
        addFinishedProduct(item.productId || item.productName, item.productName, -item.qtyTons);
      }
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormOpen(false);
      setFormType(""); setFormStatus(""); setFormPricing("wholesale"); setFormDiscount("0");
      setFormItems([{ productId: "", productName: "", productCode: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]);
    }, 1200);
  };

  const statusBadge = (status: string) => {
    if (status === "paid" || status === "approved") return <span className="text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5 text-[10px] font-medium">{t("مدفوع", "Paid")}</span>;
    if (status === "pending") return <span className="text-amber-500 bg-amber-500/10 rounded-full px-2 py-0.5 text-[10px] font-medium">{t("معلق", "Pending")}</span>;
    if (status === "overdue") return <span className="text-destructive bg-destructive/10 rounded-full px-2 py-0.5 text-[10px] font-medium">{t("متأخر", "Overdue")}</span>;
    if (status === "returned") return <span className="text-orange-500 bg-orange-500/10 rounded-full px-2 py-0.5 text-[10px] font-medium">{t("مرتجع", "Return")}</span>;
    return null;
  };

  // ── Customer Report ──
  const handleGenerateCustomerReport = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };
  const handleDownloadCustomerPDF = () => {
    const rptCusts = customers.filter(c => {
      if (repCustId && c.id !== repCustId) return false;
      const cInvs = invoices.filter(i => i.customerName === c.name);
      if (repDateMode === "all") return true;
      if (repDateMode === "today") return cInvs.some(i => i.date === todayStr);
      if (repDateMode === "range") return cInvs.some(i => (!repDateFrom || i.date >= repDateFrom) && (!repDateTo || i.date <= repDateTo));
      return true;
    });
    const rptCustCount = rptCusts.length;
    const rptTotalDebt = rptCusts.reduce((s, c) => s + (c.outstandingDebt || 0), 0);
    const rptTotalInvs = rptCusts.reduce((s, c) => s + invoices.filter(i => i.customerName === c.name).length, 0);
    const rptTopCusts = rptCusts.map(c => ({ ...c, invCount: invoices.filter(i => i.customerName === c.name).length, invTotal: invoices.filter(i => i.customerName === c.name).reduce((s, i) => s + i.total, 0) })).sort((a, b) => b.invTotal - a.invTotal).slice(0, 10);
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = repDateMode === "all" ? t("كل العملاء", "All Customers") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;
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
      .num-blue{color:#1d4ed8}.num-green{color:#15803d}.num-amber{color:#b45309}.num-red{color:#dc2626}
      table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11px;border-radius:6px;overflow:hidden}
      th{background:#1d4ed8;color:#fff;font-weight:600;padding:7px 6px;font-size:11px}
      td{border:1px solid #e2e8f0;padding:6px}
      tr:nth-child(even){background:#f8fafc}
      .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:500}
      .badge-green{background:#dcfce7;color:#15803d}.badge-red{background:#fee2e2;color:#dc2626}
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
    `;
    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right"><h1>${t("تقرير العملاء", "Customers Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>👥 ${rptCustCount} ${t("عميل", "customer(s)")}</span><span>💰 ${formatCurrency(rptTotalDebt)} ${t("مديونيات", "debts")}</span><span>📄 ${rptTotalInvs} ${t("فاتورة", "invoice(s)")}</span></div>
      ${repSummary ? `
      <div class="section"><h2>${t("ملخص العملاء", "Customers Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${rptCustCount}</div><div class="lbl">${t("إجمالي العملاء", "Total Customers")}</div></div>
          <div class="card"><div class="num ${rptTotalDebt > 0 ? "num-red" : "num-green"}">${formatCurrency(rptTotalDebt)}</div><div class="lbl">${t("إجمالي المديونيات", "Total Debt")}</div></div>
          <div class="card"><div class="num num-blue">${rptTotalInvs}</div><div class="lbl">${t("إجمالي الفواتير", "Total Invoices")}</div></div>
          <div class="card"><div class="num num-green">${rptCusts.filter(c => !c.outstandingDebt).length}</div><div class="lbl">${t("بدون مديونية", "No Debt")}</div></div>
        </div>
      </div>` : ""}
      ${repTop && rptTopCusts.length > 0 ? `
      <div class="section"><h2>${t("أفضل العملاء", "Top Customers")}</h2>
        <table><tr><th>#</th><th>${t("العميل", "Customer")}</th><th>${t("الهاتف", "Phone")}</th><th>${t("الفواتير", "Invoices")}</th><th>${t("الإجمالي", "Total")}</th><th>${t("المديونية", "Debt")}</th></tr>
        ${rptTopCusts.map((c, i) => `<tr><td>${i + 1}</td><td><strong>${c.name}</strong></td><td>${c.phone || "—"}</td><td>${c.invCount}</td><td>${formatCurrency(c.invTotal)}</td><td style="color:${c.outstandingDebt > 0 ? "#dc2626" : "#15803d"}">${formatCurrency(c.outstandingDebt || 0)}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      ${repList && rptCusts.length > 0 ? `
      <div class="section"><h2>${t("قائمة العملاء", "Customer List")} (${rptCustCount})</h2>
        <table><tr><th>#</th><th>${t("الاسم", "Name")}</th><th>${t("الهاتف", "Phone")}</th><th>${t("العنوان", "Address")}</th><th>${t("المحافظة", "Governorate")}</th><th>${t("المديونية", "Debt")}</th></tr>
        ${rptCusts.map((c, i) => `<tr><td>${i + 1}</td><td><strong>${c.name}</strong></td><td>${c.phone || "—"}</td><td>${c.address || "—"}</td><td>${c.governorate || "—"}</td><td style="color:${c.outstandingDebt > 0 ? "#dc2626" : "#15803d"};font-weight:600">${formatCurrency(c.outstandingDebt || 0)}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      <div class="footer"><p><span class="footer-logo">${companyName || "تاج"}</span> — ${t("جميع الحقوق محفوظة", "All rights reserved")} © ${new Date().getFullYear()}</p><p style="margin-top:2px">${t("تم إنشاؤه بواسطة", "Generated by")} تاج — ${nowStr}</p></div>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("العملاء", "Customers")}</h1>
          <p className="text-muted-foreground mt-1">{t("إدارة علاقات العملاء والمديونيات", "Manage customer relationships and debts")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setRepOpen(true)}>
            <BarChart3 className="w-4 h-4" />{t("تقرير", "Report")}
          </Button>
          <Button className="w-full sm:w-auto gap-2" onClick={() => setAddOpen(true)} data-testid="button-add-customer">
            <Users className="w-4 h-4" />
            {t("إضافة عميل جديد", "Add Customer")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("ابحث بالاسم أو رقم الهاتف...", "Search by name or phone...")}
            className="pr-9 h-9 text-xs w-full"
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        {searchQ && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground/60 mt-2">
            {t(`تم العثور على ${filteredCustomers.length} من أصل ${customers.length} عميل`, `Found ${filteredCustomers.length} of ${customers.length} customers`)}
          </motion.div>
        )}
      </motion.div>

      {/* Customer Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        <AnimatePresence>
          {filteredCustomers.length === 0 ? (
            <motion.div variants={itemVariants} className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">{searchQ ? t("لا يوجد عملاء مطابقين", "No matching customers") : t("لا يوجد عملاء", "No customers")}</p>
            </motion.div>
          ) : filteredCustomers.map(customer => (
            <motion.div variants={itemVariants} key={customer.id} layout>
              <Card
                className="p-3 sm:p-6 hover:shadow-md transition-shadow group cursor-pointer border-t-4 border-t-transparent hover:border-t-primary"
                data-testid={`card-customer-${customer.id}`}
                onClick={() => { setSelectedCustomer(customer); setProfileOpen(true); }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{customer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />
                      {customer.region}، {customer.governorate}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {customer.name.substring(0, 2)}
                    </div>
                    <button onClick={e => { e.stopPropagation(); const linked = invoices.some(i => i.customerName === customer.name); if (linked) setDeleteBlockId(customer.id); else setDeleteConfirmId(customer.id); }}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" /><span dir="ltr">{customer.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CreditCard className="w-4 h-4" />
                    <span>{t("حد الائتمان:", "Credit Limit:")} <span className="font-semibold text-foreground">{formatCurrency(customer.creditLimit)}</span></span>
                  </div>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg flex justify-between items-center text-sm mb-4">
                  <span className="text-muted-foreground">{t("المديونية", "Debt")}</span>
                  <span className={`font-bold ${customer.outstandingDebt > 0 ? "text-destructive" : "text-emerald-500"}`}>
                    {formatCurrency(customer.outstandingDebt)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-xs text-muted-foreground">{t("آخر شراء:", "Last Purchase:")} {fmtDate(customer.lastPurchase)}</span>
                  <span className="text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t("التفاصيل", "Details")}
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Add Customer Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("إضافة عميل جديد", "Add New Customer")}</SheetTitle>
            <SheetDescription>{t("أدخل بيانات العميل الجديد", "Enter new customer details")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("اسم العميل / الشركة", "Customer / Company Name")}</Label>
              <SmartInput field="customer-name" placeholder={t("مثال: مزارع الوطنية...", "e.g. Al-Watania Farms...")} value={name} onChange={setName} extraSuggestions={customers.map(c => c.name)} />
            </div>
            <div className="space-y-2">
              <Label>{t("رقم الهاتف", "Phone Number")}</Label>
              <Input placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" data-testid="input-customer-phone" />
            </div>
            <div className="space-y-2">
              <Label>{t("العنوان", "Address")}</Label>
              <Input placeholder={t("العنوان التفصيلي", "Detailed address")} value={address} onChange={e => setAddress(e.target.value)} data-testid="input-customer-address" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label>{t("المنطقة", "Region")}</Label>
                <Input placeholder={t("مثال: الدلتا", "e.g. Delta")} value={region} onChange={e => setRegion(e.target.value)} data-testid="input-customer-region" />
              </div>
              <div className="space-y-2">
                <Label>{t("المحافظة", "Governorate")}</Label>
                <Select value={governorate} onValueChange={setGovernorate}>
                  <SelectTrigger data-testid="select-customer-governorate"><SelectValue placeholder={t("اختر", "Select")} /></SelectTrigger>
                  <SelectContent>
                    {governorates.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("حد الائتمان (ج.م)", "Credit Limit (EGP)")}</Label>
              <Input type="number" min="0" placeholder="0" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} data-testid="input-customer-credit-limit" />
            </div>
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-medium">{t("تم الإضافة!", "Customer added!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex gap-3">
                  <Button className="flex-1" onClick={handleSubmit} disabled={!name || !phone || !governorate} data-testid="button-submit-customer">
                    {t("إضافة العميل", "Add Customer")}
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAddOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* Customer Profile Sheet */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedCustomer && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                    {selectedCustomer.name.substring(0, 2)}
                  </div>
                  <div>
                    <SheetTitle className="text-xl">{selectedCustomer.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />{selectedCustomer.region}، {selectedCustomer.governorate}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6">
                {[
                  { icon: TrendingUp, label: t("إجمالي المشتريات", "Total Purchases"), value: formatCurrency(selectedCustomer.totalPurchases), color: "text-primary" },
                  { icon: AlertTriangle, label: t("المديونية الحالية", "Current Debt"), value: formatCurrency(selectedCustomer.outstandingDebt), color: selectedCustomer.outstandingDebt > 0 ? "text-destructive" : "text-emerald-500" },
                  { icon: CreditCard, label: t("حد الائتمان", "Credit Limit"), value: formatCurrency(selectedCustomer.creditLimit), color: "text-foreground" },
                  { icon: Calendar, label: t("آخر شراء", "Last Purchase"), value: selectedCustomer.lastPurchase, color: "text-foreground" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <Card key={label} className="p-2 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <p className={`font-bold text-sm ${color}`}>{value}</p>
                  </Card>
                ))}
              </div>

              {/* Transaction History */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  {t("سجل المعاملات", "Transaction History")}
                </h4>

                {/* Date filter */}
                <div className="flex items-center gap-1.5 flex-wrap bg-muted/20 p-1.5 rounded-lg border border-border/30 mb-3">
                  {(["all", "today", "custom"] as const).map(mode => (
                    <motion.button key={mode} layout whileHover={{ y: -2, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ y: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                      onClick={() => { setTransDateMode(mode); if (mode !== "custom") { setTransDateFrom(""); setTransDateTo(""); } }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${transDateMode === mode ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      {mode === "all" ? t("الكل", "All") : mode === "today" ? t("اليوم", "Today") : t("مخصص", "Custom")}
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence>
                  {transDateMode === "custom" && (
                    <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      className="flex items-center gap-2 p-2 bg-primary/[0.04] border border-primary/15 rounded-lg mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground shrink-0">{t("من", "From")}</span>
                        <Input type="date" value={transDateFrom} onChange={e => setTransDateFrom(e.target.value)} className="h-7 w-[120px] text-xs" />
                      </div>
                      <ArrowLeftRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground shrink-0">{t("إلى", "To")}</span>
                        <Input type="date" value={transDateTo} onChange={e => setTransDateTo(e.target.value)} className="h-7 w-[120px] text-xs" />
                      </div>
                      {(transDateFrom || transDateTo) && (
                        <button onClick={() => { setTransDateFrom(""); setTransDateTo(""); }} className="p-1 rounded text-destructive hover:bg-destructive/10">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Type filter */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span className="text-[10px] text-muted-foreground/60 font-medium">{t("النوع:", "Type:")}</span>
                  <div className="flex gap-1 flex-wrap">
                    {(["all", "cash", "credit", "wholesale", "retail", "return", "payment"] as const).map(v => (
                      <motion.button key={v} layout whileHover={{ y: -2, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ y: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                        onClick={() => setTransFilterType(v)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${transFilterType === v
                          ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                          : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 border border-transparent"}`}>
                        {v === "all" ? t("الكل", "All") : v === "cash" ? t("نقدي", "Cash") : v === "credit" ? t("آجل", "Credit") : v === "wholesale" ? t("جملة", "Wholesale") : v === "retail" ? t("قطاعي", "Retail") : v === "return" ? t("مرتجع", "Return") : t("قبض", "Receipt")}
                      </motion.button>
                    ))}
                  </div>
                </div>
                {/* Status filter */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className="text-[10px] text-muted-foreground/60 font-medium">{t("الحالة:", "Status:")}</span>
                  <div className="flex gap-1 flex-wrap">
                    {(["all", "paid", "pending", "overdue", "returned"] as const).map(v => (
                      <motion.button key={v} layout whileHover={{ y: -2, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ y: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                        onClick={() => setTransFilterStatus(v)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${transFilterStatus === v
                          ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                          : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 border border-transparent"}`}>
                        {v === "all" ? t("الكل", "All") : v === "paid" ? t("مدفوع", "Paid") : v === "pending" ? t("معلق", "Pending") : v === "overdue" ? t("متأخر", "Overdue") : t("مرتجع", "Return")}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Transactions list */}
                <div className="space-y-2">
                  {customerTransactions.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <FileText className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-xs">{t("لا توجد معاملات", "No transactions")}</p>
                    </div>
                  ) : customerTransactions.map((tx, i) => (
                    <motion.div key={`${tx.type}-${tx.id}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className={`flex justify-between items-center p-3 rounded-lg border border-border/50 cursor-pointer transition-colors hover:bg-accent/40 ${tx.type === "return" ? "bg-orange-500/5 border-orange-500/20" : tx.type === "payment" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20"}`}
                      onClick={() => {
                        if (tx.type === "invoice") {
                          const inv = invoices.find(i => i.id === tx.id);
                          if (inv) { setDetailInv(inv); setDetailOpen(true); }
                        }
                      }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {tx.type === "return" ? <RotateCcw className="w-3 h-3 text-orange-500 shrink-0" /> : tx.type === "payment" ? <HandCoins className="w-3 h-3 text-emerald-500 shrink-0" /> : <ShoppingCart className="w-3 h-3 text-primary shrink-0" />}
                          <p className="text-xs font-medium truncate">{tx.desc}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(tx.date)}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className={`text-xs font-bold ${tx.type === "return" ? "text-orange-600" : tx.type === "payment" ? "text-emerald-500" : "text-primary"}`}>
                          {tx.type === "payment" ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                        </p>
                        <div className="mt-0.5">{tx.type === "payment" ? (
                          <span className="text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5 text-[10px] font-medium">{t("مدفوع", "Paid")}</span>
                        ) : statusBadge(tx.status)}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <motion.div whileHover={{ y: -1, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                  <Button className="gap-2 w-full" data-testid="button-create-invoice-for-customer"
                    onClick={() => {
                      setFormType(""); setFormStatus(""); setFormPricing("wholesale"); setFormDiscount("0");
                      setFormItems([{ productId: "", productName: "", productCode: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]);
                      setFormOpen(true);
                    }}>
                    <ShoppingCart className="w-4 h-4" />{t("إنشاء فاتورة", "Create Invoice")}
                  </Button>
                </motion.div>
                <Button variant="outline" className="gap-2" data-testid="button-call-customer">
                  <Phone className="w-4 h-4" />{t("اتصال", "Call")}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Invoice detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-primary" />{t("تفاصيل الفاتورة", "Invoice Details")}
            </DialogTitle>
            <DialogDescription className="text-xs">{detailInv?.id}</DialogDescription>
          </DialogHeader>
          {detailInv && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground">{detailInv.customerName}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{detailInv.customerPhone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{detailInv.type}</Badge>
                  <Badge className={`text-[10px] ${detailInv.status === "paid" ? "bg-green-500/10 text-green-600" : detailInv.status === "pending" ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"}`}>
                    {detailInv.status}
                  </Badge>
                </div>
              </div>
              {detailInv.items.map((it, i) => (
                <div key={i} className="rounded-lg border border-border p-3 text-xs space-y-1">
                  <div className="flex justify-between font-semibold"><span>{it.productName}</span><span>{formatCurrency(it.qtyTons * it.pricePerTon)}</span></div>
                  <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{it.qtyTons} {t("طن", "T")}</span>
                    {it.bagCount > 0 && <><span className="opacity-40">|</span><span>{it.bagCount.toLocaleString("ar-EG")} {t("شيكارة", "bags")} × {it.bagWeight} {t("كجم", "kg")}</span></>}
                    <span className="opacity-40">|</span><span>{formatCurrency(it.pricePerTon)}/{t("ط", "T")}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>{t("الإجمالي", "Subtotal")}</span><span>{formatCurrency(detailInv.items.reduce((s, i) => s + i.qtyTons * i.pricePerTon, 0))}</span></div>
                {detailInv.discountPct > 0 && <div className="flex justify-between text-xs text-destructive"><span>{t("خصم", "Discount")} {detailInv.discountPct}%</span><span>-{formatCurrency(detailInv.discountAmt)}</span></div>}
                {detailInv.taxPct > 0 && <div className="flex justify-between text-xs text-amber-500"><span>{t("ضريبة", "Tax")} {detailInv.taxPct}%</span><span>+{formatCurrency(detailInv.taxAmt)}</span></div>}
                <div className="flex justify-between font-bold text-lg"><span>{t("الإجمالي", "Total")}</span><span className="text-primary">{formatCurrency(detailInv.total)}</span></div>
              </div>
              {(detailInv.paidAmount || 0) > 0 && (
                <div className="rounded-xl bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("المدفوع", "Paid")}</span>
                    <span className="font-semibold text-emerald-500">{formatCurrency(detailInv.paidAmount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, ((detailInv.paidAmount || 0) / detailInv.total) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-lg mx-4 max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="w-4 h-4 text-primary" />{t("فاتورة جديدة", "New Invoice")}
            </DialogTitle>
            <DialogDescription className="text-xs">{selectedCustomer?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("النوع", "Type")}</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("اختر النوع", "Select type")} /></SelectTrigger>
                  <SelectContent>
                    {["cash", "credit", "wholesale", "retail"].map(v => (
                      <SelectItem key={v} value={v}>{v === "cash" ? t("نقدي", "Cash") : v === "credit" ? t("آجل", "Credit") : v === "wholesale" ? t("جملة", "Wholesale") : t("قطاعي", "Retail")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("الحالة", "Status")}</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("اختر الحالة", "Select status")} /></SelectTrigger>
                  <SelectContent>
                    {["paid", "pending", "overdue"].map(v => (
                      <SelectItem key={v} value={v}>{v === "paid" ? t("مدفوع", "Paid") : v === "pending" ? t("معلق", "Pending") : t("متأخر", "Overdue")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formType === "credit" && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border border-border/50">
                <span className="text-xs text-muted-foreground">{t("التسعيرة:", "Pricing:")}</span>
                <div className="relative flex gap-1">
                  {(["wholesale", "retail"] as const).map(p => (
                    <motion.button key={p} layout
                      whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      whileTap={{ y: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                      onClick={() => setFormPricing(p)}
                      className={`relative px-2.5 py-1 rounded text-xs font-medium transition-colors ${formPricing === p ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {formPricing === p && (
                        <motion.div layoutId="pricingActiveCust" transition={{ type: "spring", stiffness: 300, damping: 28 }}
                          className="absolute inset-0 bg-primary rounded shadow-sm" />
                      )}
                      <span className="relative z-[1]">{p === "wholesale" ? t("جملة", "Wholesale") : t("قطاعي", "Retail")}</span>
                    </motion.button>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground mr-auto">
                  {t("آجل + جملة افتراضياً", "Credit defaults to Wholesale")}
                </span>
              </div>
            )}

            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{t("المنتجات", "Products")}</span>
                <motion.div whileHover={{ y: -1, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setFormItems(prev => [...prev, { productId: "", productName: "", productCode: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }])}>
                    <Plus className="w-3 h-3" />{t("إضافة", "Add")}
                  </Button>
                </motion.div>
              </div>
              {formItems.map((item, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 sm:col-span-1">
                      <Label className="text-xs text-muted-foreground">{t("المنتج", "Product")}</Label>
                      <Select value={item.productId} onValueChange={v => {
                        const p = products.find(p => p.id === v);
                        setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: v, productName: p?.name || "", pricePerTon: p?.wholeSalePrice || 0, bagWeight: p?.bagWeight || 50 } : it));
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("اختر...", "Select...")} /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("الكمية (طن)", "Qty (Tons)")}</Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="0" step="0.001" className="h-8 text-xs" value={item.qtyTons || ""} onChange={e => setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, qtyTons: parseFloat(e.target.value) || 0, bagCount: it.bagWeight > 0 ? Math.round((parseFloat(e.target.value) || 0) * 1000 / it.bagWeight) : 0 } : it))} />
                        <Scale className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("السعر للطن", "Price/Ton")}</Label>
                      <Input type="number" min="0" className="h-8 text-xs" value={item.pricePerTon || ""} onChange={e => setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, pricePerTon: parseFloat(e.target.value) || 0 } : it))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("وزن الشيكارة (كجم)", "Bag Wt (kg)")}</Label>
                      <div className="flex gap-1">
                        <Input type="number" min="1" className="h-8 w-[72px] text-xs" value={item.bagWeight || ""} onChange={e => { const w = parseInt(e.target.value) || 50; setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, bagWeight: w, bagCount: it.qtyTons > 0 ? Math.round((it.qtyTons * 1000) / w) : it.bagCount } : it)); }} />
                        <div className="flex gap-0.5">
                          {[25, 50, 100].map(w => (
                            <motion.button key={w} type="button" layout
                              whileHover={{ y: -2, boxShadow: "0 3px 8px rgba(0,0,0,0.1)" }}
                              whileTap={{ scale: 0.9, y: 0 }}
                              transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                              onClick={() => setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, bagWeight: w, bagCount: it.qtyTons > 0 ? Math.round((it.qtyTons * 1000) / w) : it.bagCount } : it))}
                              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${item.bagWeight === w ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                              {w}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("عدد الشكاير", "Bag Count")}</Label>
                      <Input type="number" min="0" className="h-8 text-xs" value={item.bagCount || ""} onChange={e => setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, bagCount: parseInt(e.target.value) || 0, qtyTons: it.bagWeight > 0 ? +(((parseInt(e.target.value) || 0) * it.bagWeight) / 1000).toFixed(3) : 0 } : it))} />
                    </div>
                    <div className="space-y-1 flex items-end">
                      <span className="text-xs text-muted-foreground pb-1.5">
                        {item.qtyTons > 0 && item.bagWeight > 0 && (
                          <span className="font-medium text-foreground">
                            = {Math.round((item.qtyTons * 1000) / item.bagWeight).toLocaleString("ar-EG")} {t("شيكارة", "bags")}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  {formItems.length > 1 && (
                    <motion.div whileHover={{ y: -1, boxShadow: "0 2px 8px rgba(220,38,38,0.1)" }} whileTap={{ scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive gap-1" onClick={() => setFormItems(prev => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-3 h-3" />{t("إزالة", "Remove")}
                      </Button>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            <Separator />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("الخصم %", "Discount %")}</Label>
                  <div className="flex items-center gap-1">
                    <Input type="number" min="0" max="100" step="0.1" className="h-8 text-xs" value={formDiscount} onChange={e => setFormDiscount(e.target.value)} />
                    <Badge variant="outline" className="h-5 px-1 text-[10px]">%</Badge>
                  </div>
                  {(() => {
                    const sub = formItems.reduce((s, i) => s + i.qtyTons * i.pricePerTon, 0);
                    const dp = parseFloat(formDiscount) || 0;
                    if (dp > 0 && maxDiscountPercent > 0 && dp > maxDiscountPercent) return <p className="text-[10px] text-destructive mt-0.5">{t("يتجاوز الحد المسموح", "Exceeds max allowed")} ({maxDiscountPercent}%)</p>;
                    return null;
                  })()}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("الضريبة %", "Tax %")}</Label>
                  <div className="flex items-center gap-1">
                    <Input type="number" disabled className="h-8 text-xs" value={taxEnabled ? taxPercent : 0} />
                    <Badge variant="outline" className="h-5 px-1 text-[10px]">%</Badge>
                  </div>
                </div>
              </div>
              {(() => {
                const sub = formItems.reduce((s, i) => s + i.qtyTons * i.pricePerTon, 0);
                const dp = parseFloat(formDiscount) || 0;
                const da = sub * dp / 100;
                const tp = taxEnabled ? taxPercent : 0;
                const ta = tp > 0 ? (sub - da) * tp / 100 : 0;
                const total = sub - da + ta;
                return (
                  <div className="rounded-lg bg-muted/50 p-2.5 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("الإجمالي", "Subtotal")}</span><span className="font-medium">{formatCurrency(sub)}</span></div>
                    {dp > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("الخصم", "Discount")} ({dp}%)</span><span className="font-medium text-destructive">-{formatCurrency(da)}</span></div>}
                    {tp > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("الضريبة", "Tax")} ({tp}%)</span><span className="font-medium text-amber-500">+{formatCurrency(ta)}</span></div>}
                    <Separator />
                    <div className="flex justify-between text-sm"><span className="font-semibold">{t("الصافي", "Total")}</span><span className="font-bold text-primary">{formatCurrency(total)}</span></div>
                  </div>
                );
              })()}
            </div>

            <motion.div whileHover={{ y: -1, boxShadow: "0 4px 15px rgba(0,0,0,0.08)" }} whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
              <Button className="w-full gap-2 rounded-xl"
                onClick={handleCreateInvoice}
                disabled={!formType || formItems.some(i => !i.productId || i.qtyTons <= 0)}>
                <Package className="w-4 h-4" />{t("إنشاء الفاتورة", "Create Invoice")}
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={v => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <Trash2 className="w-5 h-5" />{t("حذف العميل", "Delete Customer")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("هل أنت متأكد من حذف هذا العميل؟", "Are you sure you want to delete this customer?")}
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="destructive" className="flex-1" onClick={async () => {
              if (deleteConfirmId) { await deleteCustomer(deleteConfirmId); setDeleteConfirmId(null); }
            }}>{t("حذف", "Delete")}</Button>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>{t("إلغاء", "Cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Linked Invoice Alert Dialog ── */}
      <Dialog open={!!deleteBlockId} onOpenChange={v => { if (!v) setDeleteBlockId(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-amber-500">
              <AlertTriangle className="w-5 h-5" />{t("لا يمكن الحذف", "Cannot Delete")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("لا يمكن حذف هذا العميل لأنه مرتبط بفواتير مبيعات.", "This customer cannot be deleted because they are linked to sales invoices.")}
          </p>
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={() => setDeleteBlockId(null)}>{t("فهمت", "Got it")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Report Dialog ── */}
      <Dialog open={repOpen} onOpenChange={v => { if (!repGenerating) setRepOpen(v); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t("تقرير العملاء", "Customers Report")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!repGenerating && !repGenerated && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">{t("الفترة", "Period")}</Label>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {([{ mode: "all" as DateMode, label: t("الكل", "All") }, { mode: "today" as DateMode, label: t("اليوم", "Today") }, { mode: "range" as DateMode, label: t("مخصص", "Custom") }]).map(d => (
                      <button key={d.mode} onClick={() => { setRepDateMode(d.mode); if (d.mode !== "range") { setRepDateFrom(""); setRepDateTo(""); } }}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${repDateMode === d.mode ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>{d.label}</button>
                    ))}
                  </div>
                  {repDateMode === "range" && (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mt-2">
                      <Input type="date" className="h-8 text-xs w-28 sm:w-36 rounded-lg" value={repDateFrom} onChange={e => setRepDateFrom(e.target.value)} />
                      <span className="text-muted-foreground text-xs">{t("إلى", "to")}</span>
                      <Input type="date" className="h-8 text-xs w-28 sm:w-36 rounded-lg" value={repDateTo} onChange={e => setRepDateTo(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs sm:text-sm">{t("العميل", "Customer")} ({t("اختياري", "Optional")})</Label>
                  <div className="relative">
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder={t("بحث عن عميل...", "Search customer...")} className="w-full pr-8 h-8 text-xs rounded-lg" value={repSearch} onChange={e => { setRepSearch(e.target.value); setRepCustId(""); }} />
                  </div>
                  {repSearch && !repCustId && (
                    <div className="max-h-32 overflow-y-auto space-y-0.5 border border-border/50 rounded-lg p-1">
                      {customers.filter(c => c.name.includes(repSearch)).slice(0, 8).map(c => (
                        <button key={c.id} type="button" onClick={() => { setRepCustId(c.id); setRepSearch(c.name); }}
                          className="w-full text-right px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors">{c.name}</button>
                      ))}
                      {customers.filter(c => c.name.includes(repSearch)).length === 0 && <p className="text-xs text-muted-foreground text-center py-2">{t("لا يوجد عملاء", "No customers found")}</p>}
                    </div>
                  )}
                  {repCustId && <button onClick={() => { setRepCustId(""); setRepSearch(""); }} className="text-[10px] text-destructive hover:underline">{t("إلغاء تحديد العميل", "Clear customer")}</button>}
                </div>
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs sm:text-sm">{t("الأقسام", "Sections")}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { key: "summary", label: t("ملخص العملاء", "Summary"), val: repSummary, set: setRepSummary },
                      { key: "list", label: t("قائمة العملاء", "Customer List"), val: repList, set: setRepList },
                      { key: "top", label: t("أفضل العملاء", "Top Customers"), val: repTop, set: setRepTop },
                    ].map(s => (
                      <button key={s.key} type="button" onClick={() => s.set(!s.val)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all ${s.val ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border/50 text-muted-foreground hover:border-border"}`}>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${s.val ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                          {s.val && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button className="flex-1 gap-2 text-xs sm:text-sm" onClick={handleGenerateCustomerReport} disabled={repDateMode === "range" && !repDateFrom && !repDateTo}>
                    <BarChart3 className="w-3.5 h-3.5" />{t("إنشاء التقرير", "Generate")}
                  </Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={() => setRepOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </div>
              </>
            )}
            {repGenerating && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 flex flex-col items-center gap-4">
                <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                  <motion.div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  <div className="absolute inset-0 flex items-center justify-center"><BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" /></div>
                </div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("جاري إنشاء التقرير...", "Generating...")}</p>
              </motion.div>
            )}
            {repGenerated && (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-4 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, delay: 0.1 }} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500" />
                  </motion.div>
                  <p className="text-sm sm:text-base font-semibold text-emerald-500">{t("تم إنشاء التقرير!", "Report generated!")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="gap-2 text-xs sm:text-sm" onClick={handleDownloadCustomerPDF}>
                    <Download className="w-3.5 h-3.5" />{t("تحميل PDF", "Download PDF")}
                  </Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={() => { setRepOpen(false); setRepGenerated(false); }}>{t("إغلاق", "Close")}</Button>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
