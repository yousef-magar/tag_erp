import React, { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { useSalesStore, type SalesInvoice, type SalesInvoiceItem, type SalesReturn, type SalesReturnItem, type Customer } from "@/hooks/use-sales-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { usePricingStore } from "@/hooks/use-pricing-store";
import { usePermission } from "@/hooks/use-permission";
import { mockData } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, FileText, Plus, Download, CheckCircle2, Trash2, X, Search, UserPlus, Package, RotateCcw, Scale, Edit3, ArrowLeftRight, Phone, Hash, Store, CalendarDays, Clock, CalendarRange, AlertTriangle, MapPin, ChevronsUpDown, Check, BarChart3, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn, fmtDate } from "@/lib/utils";
import SmartInput from "@/components/SmartInput";
import { getUnitLabel, getBaseUnitLabel, getBaseUnit, getDefaultUnit } from "@/lib/product-config";
import { getFeedTermSuggestions } from "@/lib/spellcheck";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const headerVariants = { hidden: { opacity: 0, y: -12, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 120, damping: 14 } } };
const cardVariants = { hidden: { opacity: 0, y: 12, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 100, damping: 13 } } };
const badgeVariants = { hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 12 } } };
const fadeSlideUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 14 } } };

type SalesTab = "invoices" | "returns" | "corrector";

const GOVERNORATES: Record<string, string[]> = {
  "القاهرة": ["وسط البلد", "مصر الجديدة", "مدينة نصر", "المعادي", "التجمع الخامس", "العباسية", "شبرا", "الزمالك", "المهندسين", "الدقي", "حلوان", "المرج"],
  "الجيزة": ["الدقي", "العجوزة", "فيصل", "الهرم", "السادس من أكتوبر", "الشيخ زايد", "أوسيم", "كرداسة", "البدرشين"],
  "الإسكندرية": ["وسط المدينة", "سموحة", "العصافرة", "ميامي", "المنتزه", "القباري", "محرم بك", "كرموز", "برج العرب"],
  "القليوبية": ["شبرا الخيمة", "بنها", "قليوب", "طوخ", "الخانكة", "قها", "كفر شكر"],
  "الشرقية": ["الزقازيق", "بلبيس", "منيا القمح", "أبو كبير", "فاقوس", "الإبراهيمية", "ههيا"],
  "الدقهلية": ["المنصورة", "طلخا", "ميت غمر", "دكرنس", "أجا", "نبروه", "بلقاس", "شربين"],
  "الغربية": ["طنطا", "المحلة الكبرى", "كفر الزيات", "بسيون", "قطور", "زفتى", "السنطة"],
  "المنوفية": ["شبين الكوم", "منوف", "الباجور", "الشهداء", "تلا", "قويسنا", "أشمون"],
  "البحيرة": ["دمنهور", "كفر الدوار", "رشيد", "إيتاي البارود", "أبو المطامير", "الدلنجات", "وادي النطرون"],
  "كفر الشيخ": ["كفر الشيخ", "بيلا", "الحامول", "مطوبس", "الرياض", "سيدي سالم"],
  "دمياط": ["دمياط", "رأس البر", "فارسكور", "الزرقا", "كفر سعد"],
  "بورسعيد": ["بورسعيد", "الزهور", "المناخ", "حى العرب", "حى الجنوب"],
  "الإسماعيلية": ["الإسماعيلية", "القنطرة شرق", "القنطرة غرب", "فايد", "أبو صوير", "التل الكبير"],
  "السويس": ["السويس", "الأربعين", "عتاقة", "فيصل", "الجناين"],
  "الفيوم": ["الفيوم", "أبشواي", "أطسا", "إبشواي", "سنورس", "طامية"],
  "بني سويف": ["بني سويف", "الواسطى", "ناصر", "الفشن", "أهناسيا", "سمسطا"],
  "المنيا": ["المنيا", "ملوي", "أبو قرقاص", "مغاغة", "بني مزار", "سمالوط", "دير مواس"],
  "أسيوط": ["أسيوط", "منفلوط", "القوصية", "أبنوب", "أبو تيج", "الغنايم", "صدفا"],
  "سوهاج": ["سوهاج", "طهطا", "جرجا", "المنشأة", "أخميم", "البلينا", "دار السلام"],
  "قنا": ["قنا", "نجع حمادي", "دشنا", "أبو تشت", "فرشوط", "قوص"],
  "الأقصر": ["الأقصر", "البياضية", "الطود", "القرنة", "إسنا", "أرمنت"],
  "أسوان": ["أسوان", "دراو", "كوم أمبو", "إدفو", "نصر النوبة"],
  "شمال سيناء": ["العريش", "الشيخ زويد", "رفح", "بئر العبد", "نخل"],
  "جنوب سيناء": ["شرم الشيخ", "دهب", "نويبع", "سانت كاترين", "رأس سدر", "طور سيناء"],
  "مطروح": ["مرسى مطروح", "الضبعة", "العلمين", "سيدي عبد الرحمن", "الحمام", "سيوة"],
  "أخرى": ["أخرى"],
};

const BAG_WEIGHTS_DEFAULT = [25, 50, 100];
const fmtCurrency = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

const MARGIN_PRESETS = [10, 15, 20, 25, 30];

function MarginSelector({ costPrice, onSelect, t, currentPrice }: { costPrice: number; onSelect: (price: number) => void; t: (ar: string, en: string) => string; currentPrice?: number }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const currentMargin = currentPrice ? Math.round((currentPrice - costPrice) / costPrice * 100) : 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-5 text-[9px] px-1.5 rounded gap-0.5 font-normal">
          <span className="text-[10px] font-medium leading-none">{currentPrice ? t(`هامش ${currentMargin}%`, `${currentMargin}% margin`) : "+" + t("هامش", "margin")}</span>
          <ChevronsUpDown className="w-2.5 h-2.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-36 p-1">
        <div className="space-y-0.5">
          {MARGIN_PRESETS.map(m => {
            const suggested = Math.round(costPrice * (1 + m / 100));
            return (
              <button key={m} type="button" onClick={() => { onSelect(suggested); setOpen(false); setCustom(""); }}
                className={`w-full flex justify-between items-center px-2 py-1 text-[10px] rounded hover:bg-muted transition-colors ${currentMargin === m ? "bg-primary/10" : ""}`}>
                <span>{m}%</span>
                <span className="font-medium text-muted-foreground">{fmtCurrency(suggested)}</span>
              </button>
            );
          })}
          <div className="border-t border-border/60 pt-0.5 mt-0.5">
            <div className="flex items-center gap-1 px-1">
              <input value={custom} onChange={e => setCustom(e.target.value)}
                placeholder={t("نسبة...", "%...")}
                className="w-12 h-5 text-[10px] border border-input rounded bg-transparent px-1 text-center"
                onKeyDown={e => { if (e.key === "Enter" && custom) { const pct = parseFloat(custom); if (pct > 0) { onSelect(Math.round(costPrice * (1 + pct / 100))); setOpen(false); setCustom(""); } } }} />
              <span className="text-[9px] text-muted-foreground">%</span>
              <button type="button" disabled={!custom}
                onClick={() => { const pct = parseFloat(custom); if (pct > 0) { onSelect(Math.round(costPrice * (1 + pct / 100))); setOpen(false); setCustom(""); } }}
                className="text-[10px] text-primary disabled:opacity-30">تطبيق</button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
function SearchableSelect({ value, onChange, options, placeholder, emptyText, onAddNew }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; emptyText?: string; onAddNew?: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter(o => o.includes(search));
  const showAdd = onAddNew && search.trim() && !options.some(o => o === search.trim());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={open}
          className="flex items-center justify-between w-full h-9 px-3 text-xs rounded-lg border border-input bg-transparent hover:bg-accent hover:text-accent-foreground transition-colors">
          <span className={value ? "" : "text-muted-foreground"}>{value || placeholder || "اختر..."}</span>
          <ChevronsUpDown className="w-3.5 h-3.5 mr-2 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="بحث..." value={search} onValueChange={setSearch} className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">{emptyText || "لا توجد نتائج"}</CommandEmpty>
            <CommandGroup>
              {filtered.map(opt => (
                <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setOpen(false); setSearch(""); }} className="text-xs">
                  <Check className={cn("w-3.5 h-3.5 ml-2", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
              {showAdd && (
                <CommandItem value={search.trim()} onSelect={() => { onAddNew(search.trim()); onChange(search.trim()); setOpen(false); setSearch(""); }} className="text-xs text-primary border-t border-border/40">
                  <Plus className="w-3.5 h-3.5 ml-2" />
                  إضافة "{search.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TagsInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const addTag = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); }
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-9 p-1.5 rounded-lg border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring">
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium whitespace-nowrap">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="hover:text-destructive transition-colors">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === "," || e.key === "،") { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground/50"
        placeholder={tags.length === 0 ? (placeholder || "اكتب واضغط Enter") : ""} />
    </div>
  );
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<number>(value);
  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (Math.abs(diff) < 0.5) { setDisplay(value); ref.current = value; return; }
    const duration = 600;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * ease);
      if (progress < 1) requestAnimationFrame(animate);
      else { setDisplay(value); ref.current = value; }
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <span className={className}>{fmtCurrency(Math.round(display))}</span>;
}

export default function Sales() {
  const { t, taxPercent, taxEnabled, maxDiscountPercent, bankAccounts, walletAccounts, discountExceedAllowed, productConfig, language, simpleInvoiceItems } = useAppStore();
  const { can } = usePermission();
  const { inventory, updateInventoryItem, addInventoryItem } = useProductionStore();
  const allProducts = useMemo(() => {
    const invProducts = inventory
      .filter(i => i.quantity > 0)
      .map(i => ({
        id: `inv-${i.id}`,
        name: i.materialName,
        code: i.type === "raw" ? "خام" : "مصنع",
        category: i.type === "raw" ? "خام" : "مصنع",
        bagWeight: i.unit === "ton" ? 50 : 1,
        wholeSalePrice: 0, retailPrice: 0, distributorPrice: 0, minSalePrice: 0,
      }));
    const seenNames = new Set(mockData.products.map(p => p.name));
    const uniqueInv = invProducts.filter(i => !seenNames.has(i.name));
    return [...mockData.products, ...uniqueInv];
  }, [inventory]);
  const products = allProducts;
  const { invoices, returns, customers, payments, addInvoice, updateInvoice, deleteInvoice, addReturn, addCustomer, updateCustomer, nextInvoiceNum, saveCustomerAddress, customRegions, addCustomRegion } = useSalesStore();
  const hrEmployees = useHRStore((s) => s.employees);
  const marketers = useMemo(() => hrEmployees.filter(e => e.department === "التسويق"), [hrEmployees]);
  const { consumeFinishedProduct, addFinishedProduct } = useProductionStore();
  const { getPrice, getCostPrice, productPrices, ensureInventoryPrices } = usePricingStore();

  const [tab, setTab] = useState<SalesTab>("invoices");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInv, setDetailInv] = useState<SalesInvoice | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // New customer dialog
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustPhone2, setNewCustPhone2] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustRegion, setNewCustRegion] = useState("");
  const [newCustGov, setNewCustGov] = useState("");
  const [newCustCenter, setNewCustCenter] = useState("");
  const [newCustCredit, setNewCustCredit] = useState("");

  // Search & filters
  const [searchQ, setSearchQ] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateMode, setDateMode] = useState<"all" | "today" | "custom">("all");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const todayStr = new Date().toISOString().split("T")[0];

  // Form
  const [formCustId, setFormCustId] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [formType, setFormType] = useState<string>("");
  const [formStatus, setFormStatus] = useState<string>("");
  const [formPricing, setFormPricing] = useState<string>("wholesale");
  const [formMarketerId, setFormMarketerId] = useState("");
  const [formDiscount, setFormDiscount] = useState("0");
  const [formPaidAmount, setFormPaidAmount] = useState("");
  const [formPayMethod, setFormPayMethod] = useState("cash");
  const [formPayBank, setFormPayBank] = useState("");
  const [formCharges, setFormCharges] = useState("");
  const [formChargesDesc, setFormChargesDesc] = useState("");
  const [excessCredit, setExcessCredit] = useState(false);
  const [formNeedsDelivery, setFormNeedsDelivery] = useState(false);
  const [formDelGov, setFormDelGov] = useState("");
  const [formDelRegion, setFormDelRegion] = useState("");
  const [formDelVillage, setFormDelVillage] = useState("");
  const [formDelDetailsTags, setFormDelDetailsTags] = useState<string[]>([]);
  const [formDelTagInput, setFormDelTagInput] = useState("");
  const [formItems, setFormItems] = useState<SalesInvoiceItem[]>([{ productId: "", productName: "", productCode: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]);

  // Product search popover state (indexed by form item)
  const [prodPopoverIdx, setProdPopoverIdx] = useState<number | null>(null);
  const [retProdPopoverIdx, setRetProdPopoverIdx] = useState<number | null>(null);

  // Return form
  const [returnOpen, setReturnOpen] = useState(false);
  const [retCustId, setRetCustId] = useState("");
  const [retCustSearch, setRetCustSearch] = useState("");
  const [retInvSearch, setRetInvSearch] = useState("");
  const [retInvId, setRetInvId] = useState("");
  const [retDiscount, setRetDiscount] = useState("0");
  const [retReason, setRetReason] = useState("");
  const [retItems, setRetItems] = useState<SalesReturnItem[]>([{ productId: "", productName: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]);

  // Report state
  type DateMode = "all" | "today" | "range";
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDateMode, setReportDateMode] = useState<DateMode>("all");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportSummary, setReportSummary] = useState(true);
  const [reportByCustomer, setReportByCustomer] = useState(true);
  const [reportListing, setReportListing] = useState(true);
  const [reportCustomerId, setReportCustomerId] = useState("");
  const [reportCustomerSearch, setReportCustomerSearch] = useState("");
  const [lastCreatedInv, setLastCreatedInv] = useState<SalesInvoice | null>(null);

  const toggleSort = (field: string) => {
    setSortField(prev => prev === field ? null : field);
    setSortDir(prev => prev === "asc" ? "desc" : "asc");
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => {
      if (filterType !== "all" && inv.type !== filterType) return false;
      if (filterStatus !== "all" && inv.status !== filterStatus) return false;
      if (dateMode === "today" && inv.date !== todayStr) return false;
      if (dateMode === "custom") {
        if (dateFrom && inv.date < dateFrom) return false;
        if (dateTo && inv.date > dateTo) return false;
      }
      if (!searchQ) return true;
      const q = searchQ.toLowerCase();
      const cust = customers.find(c => c.id === inv.customerId);
      return inv.id.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (cust?.phone || "").includes(q) ||
        (cust?.code || "").toLowerCase().includes(q);
    });
    if (sortField) {
      result.sort((a, b) => {
        let cmp = 0;
        if (sortField === "id") cmp = a.id.localeCompare(b.id);
        else if (sortField === "customerName") cmp = a.customerName.localeCompare(b.customerName);
        else if (sortField === "type") cmp = a.type.localeCompare(b.type);
        else if (sortField === "date") cmp = a.date.localeCompare(b.date);
        else if (sortField === "total") cmp = a.total - b.total;
        else if (sortField === "status") cmp = a.status.localeCompare(b.status);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [invoices, searchQ, filterType, filterStatus, customers, dateFrom, dateTo, dateMode, todayStr, sortField, sortDir]);

  const filteredReturns = useMemo(() => {
    if (!searchQ) return returns;
    const q = searchQ.toLowerCase();
    return returns.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.invoiceId.toLowerCase().includes(q)
    );
  }, [returns, searchQ]);

  const summaryStats = useMemo(() => ({
    totalInvoices: filteredInvoices.length,
    totalRevenue: filteredInvoices.reduce((s, i) => s + i.total, 0),
    pendingCount: filteredInvoices.filter(i => i.status === "pending" || i.status === "overdue").length,
    returnsCount: filteredReturns.length,
    returnsTotal: filteredReturns.reduce((s, r) => s + r.total, 0),
  }), [filteredInvoices, filteredReturns]);

  // ── Sales Report ──
  const handleGenerateSalesReport = () => {
    if (reportDateMode === "range" && !reportDateFrom && !reportDateTo) return;
    setReportGenerating(true);
    setTimeout(() => { setReportGenerating(false); setReportGenerated(true); }, 1200);
  };
  const handleDownloadSalesPDF = () => {
    const reportInvoices = invoices.filter(inv => {
      if (reportDateMode === "today" && inv.date !== todayStr) return false;
      if (reportDateMode === "range") { if (reportDateFrom && inv.date < reportDateFrom) return false; if (reportDateTo && inv.date > reportDateTo) return false; }
      if (reportCustomerId && inv.customerId !== reportCustomerId) return false;
      return true;
    });
    const rptTotal = reportInvoices.length;
    const rptRevenue = reportInvoices.reduce((s, i) => s + i.total, 0);
    const rptPaid = reportInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const rptPending = reportInvoices.filter(i => i.status === "pending" || i.status === "overdue");
    const rptByCustomer: Record<string, { count: number; total: number }> = {};
    reportInvoices.forEach(inv => {
      if (!rptByCustomer[inv.customerName]) rptByCustomer[inv.customerName] = { count: 0, total: 0 };
      rptByCustomer[inv.customerName].count++;
      rptByCustomer[inv.customerName].total += inv.total;
    });
    const topCustomers = Object.entries(rptByCustomer).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = reportDateMode === "all" ? t("كل المبيعات", "All Sales") : reportDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${reportDateFrom || "..."} ${t("إلى", "to")} ${reportDateTo || "..."}`;

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
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
    `;

    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right">
          <h1>${t("تقرير المبيعات", "Sales Report")}</h1>
          <p class="sub">${periodLabel}</p>
        </div>
        <div class="header-left">
          ${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}
          <div class="company">${companyName || "تاج"}</div>
          ${companyAddress ? `<div>${companyAddress}</div>` : ""}
          <div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div>
        </div>
      </div>
      <div class="meta">
        <span>📄 ${rptTotal} ${t("فاتورة", "invoice(s)")}</span>
        <span>💰 ${fmtCurrency(rptRevenue)}</span>
      </div>
      ${reportSummary ? `
      <div class="section">
        <h2>${t("ملخص المبيعات", "Sales Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num" style="color:#1d4ed8">${rptTotal}</div><div class="lbl">${t("الفواتير", "Invoices")}</div></div>
          <div class="card"><div class="num" style="color:#1d4ed8">${fmtCurrency(rptRevenue)}</div><div class="lbl">${t("الإيرادات", "Revenue")}</div></div>
          <div class="card"><div class="num" style="color:#15803d">${fmtCurrency(rptPaid)}</div><div class="lbl">${t("المدفوع", "Paid")}</div></div>
          <div class="card"><div class="num" style="color:#b45309">${rptPending.length}</div><div class="lbl">${t("معلق/متأخر", "Pending/Overdue")}</div></div>
        </div>
      </div>` : ""}
      ${reportByCustomer && topCustomers.length > 0 ? `
      <div class="section">
        <h2>${t("المبيعات حسب العميل", "Sales by Customer")}</h2>
        <table>
          <tr><th>#</th><th>${t("العميل", "Customer")}</th><th>${t("الفواتير", "Invoices")}</th><th>${t("الإجمالي", "Total")}</th></tr>
          ${topCustomers.map(([name, data], i) => `<tr><td>${i + 1}</td><td><strong>${name}</strong></td><td>${data.count}</td><td>${fmtCurrency(data.total)}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      ${reportListing && reportInvoices.length > 0 ? `
      <div class="section">
        <h2>${t("قائمة الفواتير", "Invoice List")} (${rptTotal})</h2>
        <table>
          <tr><th>${t("الفاتورة", "Invoice")}</th><th>${t("العميل", "Customer")}</th><th>${t("التاريخ", "Date")}</th><th>${t("النوع", "Type")}</th><th>${t("الحالة", "Status")}</th><th>${t("الإجمالي", "Total")}</th></tr>
          ${reportInvoices.map(inv => {
            const st = inv.status === "paid" ? `<span class="badge badge-green">${t("مدفوع", "Paid")}</span>` : inv.status === "overdue" ? `<span class="badge badge-red">${t("متأخر", "Overdue")}</span>` : `<span class="badge badge-amber">${t("معلق", "Pending")}</span>`;
            return `<tr><td style="font-weight:600">${inv.id}</td><td>${inv.customerName}</td><td>${inv.date}</td><td>${inv.type}</td><td>${st}</td><td style="font-weight:600">${fmtCurrency(inv.total)}</td></tr>`;
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

  // ── Print Invoice ──
  const handlePrintInvoice = (inv: SalesInvoice) => {
    const { companyName, companyLogo, companyAddress, invoicePaperSize, invoiceOrientation, invoiceFontSize, invoiceShowLogo, productConfig: printCfg } = useAppStore.getState();
    const cust = customers.find(c => c.id === inv.customerId);
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const paperSizeMap: Record<string, string> = { A4: "210mm 297mm", A5: "148mm 210mm", A7: "74mm 105mm" };
    const ps = paperSizeMap[invoicePaperSize] || "210mm 297mm";

    const styles = `
      @page{size:${ps} ${invoiceOrientation};margin:8mm 12mm}
      body{font-family:'Segoe UI',Tahoma,sans-serif;direction:rtl;color:#1e293b;line-height:1.5;font-size:${invoiceFontSize}pt;padding:0;margin:0}
      .inv-header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1d4ed8;padding-bottom:8px;margin-bottom:12px}
      .inv-header h1{font-size:${Math.max(invoiceFontSize + 4, 14)}pt;margin:0 0 2px;color:#1d4ed8;font-weight:800}
      .inv-header .sub{font-size:${Math.max(invoiceFontSize - 1, 8)}pt;color:#64748b;margin:0}
      .inv-header .left{text-align:left;font-size:${Math.max(invoiceFontSize - 1, 8)}pt;color:#64748b}
      .inv-info{display:flex;justify-content:space-between;font-size:${Math.max(invoiceFontSize - 1, 8)}pt;margin-bottom:10px;padding:6px 8px;background:#f8fafc;border-radius:4px}
      .inv-info div{line-height:1.6}
      table{width:100%;border-collapse:collapse;margin:8px 0;font-size:${Math.max(invoiceFontSize - 1, 8)}pt}
      th{background:#1d4ed8;color:#fff;font-weight:600;padding:5px 4px;font-size:${Math.max(invoiceFontSize - 2, 7)}pt}
      td{border:1px solid #e2e8f0;padding:4px}
      tr:nth-child(even){background:#f8fafc}
      .totals{margin-top:8px;padding-top:6px;border-top:2px solid #1d4ed8}
      .totals table{width:auto;margin-left:auto}
      .totals td{padding:3px 12px;border:none}
      .totals .grand{font-size:${Math.max(invoiceFontSize + 2, 12)}pt;font-weight:800;color:#1d4ed8}
      .footer{text-align:center;font-size:${Math.max(invoiceFontSize - 3, 7)}pt;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:15px}
    `;

    const content = `
      <div class="inv-header">
        <div>
          <h1>${t("فاتورة بيع", "Sales Invoice")}</h1>
          <p class="sub">${inv.id}</p>
        </div>
        <div class="left">
          ${invoiceShowLogo && companyLogo ? `<img src="${companyLogo}" style="max-height:35px;margin-bottom:2px" alt=""/><br/>` : ""}
          <div><strong>${companyName || "تاج"}</strong></div>
          ${companyAddress ? `<div>${companyAddress}</div>` : ""}
        </div>
      </div>
      <div class="inv-info">
        <div>
          <strong>${t("العميل", "Customer")}:</strong> ${inv.customerName}<br/>
          <strong>${t("الهاتف", "Phone")}:</strong> ${inv.customerPhone || cust?.phone || ""}<br/>
          ${cust?.address ? `<strong>${t("العنوان", "Address")}:</strong> ${cust.address}` : ""}
          ${inv.deliveryAddress ? `<br/><strong>${t("التوصيل", "Delivery")}:</strong> ${inv.deliveryAddress.governorate} - ${inv.deliveryAddress.region}${inv.deliveryAddress.details ? ", " + inv.deliveryAddress.details : ""}` : ""}
        </div>
        <div style="text-align:left">
          <strong>${t("التاريخ", "Date")}:</strong> ${inv.date}<br/>
          <strong>${t("النوع", "Type")}:</strong> ${inv.type === "cash" ? t("نقدي", "Cash") : inv.type === "credit" ? t("آجل", "Credit") : inv.type === "wholesale" ? t("جملة", "Wholesale") : t("قطاعي", "Retail")}<br/>
          <strong>${t("الحالة", "Status")}:</strong> ${inv.status === "paid" ? t("مدفوع", "Paid") : inv.status === "pending" ? t("معلق", "Pending") : t("متأخر", "Overdue")}
        </div>
      </div>
      <table>
        <tr><th>#</th><th>${t("المنتج", "Product")}</th><th>${t("الكمية", "Qty")}</th><th>${t("الشكاير", "Bags")}</th><th>${t("السعر", "Price")}</th><th>${t("الإجمالي", "Total")}</th></tr>
        ${inv.items.map((item, i) => `<tr><td>${i + 1}</td><td><strong>${item.productName}</strong></td><td>${item.qtyTons} ${getBaseUnitLabel(printCfg, language)}</td><td>${item.bagCount > 0 ? item.bagCount + "×" + item.bagWeight + getUnitLabel(printCfg, "kg", language) : "—"}</td><td>${fmtCurrency(item.pricePerTon)}/${getBaseUnitLabel(printCfg, language)}</td><td style="font-weight:600">${fmtCurrency(item.qtyTons * item.pricePerTon)}</td></tr>`).join("")}
      </table>
      <div class="totals">
        <table>
          <tr><td>${t("الإجمالي الفرعي", "Subtotal")}</td><td>${fmtCurrency(inv.subtotal)}</td></tr>
          ${inv.discountPct > 0 ? `<tr><td>${t("الخصم", "Discount")} (${inv.discountPct}%)</td><td style="color:#dc2626">-${fmtCurrency(inv.discountAmt)}</td></tr>` : ""}
          ${inv.taxPct > 0 ? `<tr><td>${t("الضريبة", "Tax")} (${inv.taxPct}%)</td><td style="color:#b45309">+${fmtCurrency(inv.taxAmt)}</td></tr>` : ""}
          ${inv.additionalCharges ? `<tr><td>${inv.additionalChargesDesc || t("رسوم إضافية", "Additional")}</td><td>${fmtCurrency(inv.additionalCharges)}</td></tr>` : ""}
          <tr class="grand"><td>${t("الإجمالي", "Total")}</td><td>${fmtCurrency(inv.total)}</td></tr>
          ${inv.paidAmount > 0 ? `<tr><td>${t("المدفوع", "Paid")}</td><td style="color:#15803d">${fmtCurrency(inv.paidAmount)}</td></tr>` : ""}
          ${inv.total - (inv.paidAmount || 0) > 0 ? `<tr><td>${t("المتبقي", "Remaining")}</td><td style="color:#dc2626">${fmtCurrency(inv.total - (inv.paidAmount || 0))}</td></tr>` : ""}
        </table>
      </div>
      <div class="footer">
        <p>${companyName || "تاج"} — ${t("جميع الحقوق محفوظة", "All rights reserved")} © ${new Date().getFullYear()}</p>
        <p>${t("طبعت في", "Printed on")} ${nowStr}</p>
      </div>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>${styles}</style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  useEffect(() => {
    try {
      const pref = localStorage.getItem("ff-new-invoice-customer");
      if (pref) {
        localStorage.removeItem("ff-new-invoice-customer");
        const match = customers.find(c => c.name === pref);
        if (match) { resetForm(); setFormCustId(match.id); setSheetOpen(true); }
      }
    } catch {}
  }, [customers]);

  useLayoutEffect(() => { ensureInventoryPrices(inventory); }, [inventory, ensureInventoryPrices]);

  const resetForm = () => {
    setFormCustId(""); setCustSearch(""); setFormType(""); setFormStatus(""); setFormPricing("wholesale"); setFormMarketerId("");
    setFormDiscount("0"); setFormPaidAmount(""); setFormPayMethod("cash"); setFormPayBank(""); setFormCharges(""); setFormChargesDesc(""); setExcessCredit(false); setFormNeedsDelivery(false); setFormDelGov(""); setFormDelRegion(""); setFormDelVillage(""); setFormDelDetailsTags([]); setFormDelTagInput("");
    setFormItems([{ productId: "", productName: "", productCode: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]);
    setEditingId(null);
  };

  const openNewInvoice = () => { resetForm(); setSheetOpen(true); };
  const openEditInvoice = (inv: SalesInvoice) => {
    setFormCustId(inv.customerId);
    setFormType(inv.type);
    setFormStatus(inv.status);
    setFormPricing(inv.pricingTier || "wholesale");
    setFormDiscount(String(inv.discountPct));
    setFormPaidAmount(String(inv.paidAmount || 0));
    setFormPayMethod((inv as any).payMethod || "cash");
    setFormPayBank((inv as any).payBank || "");
    setFormCharges(String(inv.additionalCharges ?? ""));
    setFormChargesDesc(inv.additionalChargesDesc ?? "");
    setFormMarketerId(inv.marketerId || "");
    setFormItems(inv.items.map(i => ({ ...i })));
    setEditingId(inv.id);
    setSheetOpen(true);
  };

  const addItem = () => setFormItems(prev => [...prev, { productId: "", productName: "", productCode: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]);
  const removeItem = (i: number) => setFormItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof SalesInvoiceItem, value: any) => {
    setFormItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      let next = { ...item, [field]: value };
      if (field === "productId") {
        const p = products.find(p => p.id === value);
        next.productName = p?.name || "";
        next.productCode = p?.code || "";
        next.pricePerTon = getPrice(value, formPricing as "wholesale" | "retail" | "distributor") || p?.wholeSalePrice || 0;
        next.bagWeight = p?.bagWeight || 50;
      }
      if (field === "qtyTons" && item.bagWeight > 0) {
        next.bagCount = Math.round((value * 1000) / item.bagWeight);
      }
      if (field === "bagCount" && item.bagWeight > 0) {
        next.qtyTons = +((value * item.bagWeight) / 1000).toFixed(3);
      }
      if (field === "bagWeight" && item.qtyTons > 0) {
        next.bagCount = Math.round((item.qtyTons * 1000) / value);
      }
      return next;
    }));
  };

  const subtotal = formItems.reduce((s, it) => s + (it.qtyTons * it.pricePerTon), 0);
  const discountAmt = subtotal * (parseFloat(formDiscount) || 0) / 100;
  const taxAmt = taxEnabled ? (subtotal - discountAmt) * taxPercent / 100 : 0;
  const total = subtotal - discountAmt + taxAmt;
  const chargesAmount = Math.max(0, parseFloat(formCharges) || 0);
  const grandTotal = total + chargesAmount;
  const rawPaid = parseFloat(formPaidAmount) || 0;
  const paidAmount = Math.min(grandTotal, rawPaid);
  const remaining = grandTotal - paidAmount;
  const excessAmount = Math.max(0, rawPaid - grandTotal);

  useEffect(() => {
    if (formType === "retail" && sheetOpen) {
      setFormStatus("paid");
      setExcessCredit(false);
    }
  }, [formType, sheetOpen]);

  useEffect(() => {
    if (formType === "credit" && sheetOpen) {
      setFormStatus("pending");
    }
  }, [formType, sheetOpen]);

  const StatusBadge = ({ status }: { status: string }) => {
    const color = status === "paid" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      : status === "pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
      : status === "overdue" ? "bg-destructive/10 text-destructive border-destructive/20"
      : "";
    return <motion.div variants={badgeVariants} initial="hidden" animate="show" className={color ? `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}` : ""}>
      {status === "paid" ? t("مدفوع", "Paid") : status === "pending" ? t("معلق", "Pending") : status === "overdue" ? t("متأخر", "Overdue") : status}
    </motion.div>;
  };
  const TypeBadge = ({ type }: { type: string }) => {
    const content = type === "wholesale" ? t("جملة", "Wholesale") : type === "credit" ? t("آجل", "Credit") : type === "cash" ? t("نقدي", "Cash") : type === "retail" ? t("قطاعي", "Retail") : type;
    const cls = type === "wholesale" ? "bg-secondary text-secondary-foreground"
      : type === "credit" ? "border border-border text-muted-foreground"
      : type === "cash" ? "bg-primary/10 text-primary border border-primary/20"
      : type === "retail" ? "bg-foreground/5 text-foreground"
      : "";
    return <motion.div variants={badgeVariants} initial="hidden" animate="show" className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {content}
    </motion.div>;
  };

  const handleSubmit = () => {
    if (!formCustId || !formType || formItems.some(i => !i.productId || i.qtyTons <= 0)) return;
    if (formItems.some(i => !i.pricePerTon)) {
      toast.error(t("يوجد منتج لم يسعر بعد. حدد سعراً أولاً", "A product has no price. Set a price first"));
      return;
    }
    if (parseFloat(formDiscount) > maxDiscountPercent && !can("sales.discount")) {
      toast.error(t("لا تملك صلاحية تجاوز حد الخصم الأقصى", "No permission to exceed max discount limit"));
      return;
    }
    const cust = customers.find(c => c.id === formCustId);
    const inv: SalesInvoice = {
      id: editingId || `INV-2025-${String(nextInvoiceNum()).padStart(3, "0")}`,
      customerId: formCustId,
      customerName: cust?.name || "",
      customerPhone: cust?.phone || "",
      type: formType as any,
      status: paidAmount >= grandTotal ? "paid" : (formStatus || "pending") as any,
      date: new Date().toISOString().split("T")[0],
      items: formItems.map(i => ({ ...i })),
      discountPct: parseFloat(formDiscount) || 0,
      taxPct: taxEnabled ? taxPercent : 0,
      subtotal, discountAmt, taxAmt, total: grandTotal,
      additionalCharges: chargesAmount || undefined,
      additionalChargesDesc: formChargesDesc || undefined,
      pricingTier: formType === "credit" ? (formPricing as "wholesale" | "retail") : undefined,
      marketerId: formMarketerId || undefined,
      paidAmount: Math.min(grandTotal, parseFloat(formPaidAmount) || 0),
        payMethod: formPayMethod || undefined,
        payBank: formPayMethod && formPayMethod !== "cash" ? formPayBank : undefined,
      needsDelivery: formNeedsDelivery || undefined,
      deliveryAddress: formNeedsDelivery ? { governorate: formDelGov, region: formDelRegion, village: formDelVillage || undefined, details: formDelDetailsTags.join("، ") } : undefined,
    } as any;
    if (editingId) {
      updateInvoice(editingId, inv);
      toast.success(t("تم تعديل الفاتورة", "Invoice updated"));
    } else {
      addInvoice(inv);
      setLastCreatedInv(inv);
      if (excessCredit && excessAmount > 0 && cust) {
        const newDebt = Math.max(0, (cust.outstandingDebt || 0) - excessAmount);
        updateCustomer(formCustId, { outstandingDebt: newDebt });
      }
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
      if (formNeedsDelivery && formDelGov) {
        saveCustomerAddress(formCustId, { governorate: formDelGov, region: formDelRegion, village: formDelVillage || undefined, details: formDelDetailsTags });
      }
      toast.success(t("تم إنشاء الفاتورة", "Invoice created"));
    }
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setSheetOpen(false); resetForm(); setLastCreatedInv(null); }, 6000);
  };

  const handleDeleteInv = (id: string) => {
    deleteInvoice(id);
    toast.info(t("تم حذف الفاتورة", "Invoice deleted"));
  };

  const handleSubmitReturn = () => {
    if (!retCustId || retItems.some(i => !i.productId || i.qtyTons <= 0)) return;
    const cust = customers.find(c => c.id === retCustId);
    const retSubtotal = retItems.reduce((s, i) => s + i.qtyTons * i.pricePerTon, 0);
    const retDiscPct = parseFloat(retDiscount) || 0;
    const retDiscAmt = retSubtotal * retDiscPct / 100;
    const retTaxPct = taxEnabled ? taxPercent : 0;
    const retTaxAmt = taxEnabled ? (retSubtotal - retDiscAmt) * taxPercent / 100 : 0;
    const retTotal = retSubtotal - retDiscAmt + retTaxAmt;
    const ret: SalesReturn = {
      id: `SRT-${Date.now()}`,
      invoiceId: retInvId === "none" ? "" : retInvId,
      customerId: retCustId,
      customerName: cust?.name || "",
      date: new Date().toISOString().split("T")[0],
      items: retItems.map(i => ({ ...i })),
      reason: retReason,
      total: retTotal,
      discountPct: retDiscPct, discountAmt: retDiscAmt,
      taxPct: retTaxPct, taxAmt: retTaxAmt,
    };
    addReturn(ret);
    for (const item of retItems) {
      const match = inventory.find(i => i.type === "finished" && i.materialName === item.productName);
      if (match) {
        const added = match.unit === "kg" ? item.qtyTons * 1000 : item.qtyTons;
        const newQty = +(match.quantity + added).toFixed(2);
        updateInventoryItem(match.id, { quantity: newQty });
      } else {
        addFinishedProduct(item.productId, item.productName, item.qtyTons);
      }
    }
    toast.success(t("تم تسجيل المرتجع", "Return recorded"));
    setReturnOpen(false);
    setRetCustId(""); setRetCustSearch(""); setRetInvSearch(""); setRetDiscount("0"); setRetReason(""); setRetInvId("");
    setRetItems([{ productId: "", productName: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]);
  };

  const handleAddCustomer = () => {
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    const id = `C${Date.now()}`;
    addCustomer({
      id, name: newCustName.trim(), phone: newCustPhone.trim(),
      phone2: newCustPhone2.trim(),
      code: `CL-${String(customers.length + 1).padStart(3, "0")}`,
      address: newCustAddress.trim(), region: newCustRegion.trim(),
      governorate: newCustGov.trim(), distributionCenter: newCustCenter.trim(),
      totalPurchases: 0, lastPurchase: "", creditLimit: parseFloat(newCustCredit) || 0, outstandingDebt: 0,
    });
    setFormCustId(id);
    setNewCustOpen(false);
    setNewCustName(""); setNewCustPhone(""); setNewCustPhone2(""); setNewCustAddress(""); setNewCustRegion(""); setNewCustGov(""); setNewCustCenter(""); setNewCustCredit("");
    toast.success(t("تم إضافة العميل", "Customer added"));
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      {/* Header */}
      <motion.div variants={headerVariants} className="relative rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-4 sm:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 100, delay: 0.1 }}>
            <div className="flex items-center gap-2.5 mb-1">
              <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.15 }}
                className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-primary" />
              </motion.div>
              <h1 className="text-xl sm:text-2xl font-bold">{t("المبيعات", "Sales")}</h1>
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="text-xs sm:text-sm text-muted-foreground">{t("إدارة الفواتير والمرتجعات", "Manage invoices & returns")}</motion.p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
            className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {tab === "returns" && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }}>
                <Button className="gap-2 rounded-xl group" onClick={() => setReturnOpen(true)}>
                  <RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-12" />{t("تسجيل مرتجع", "Record Return")}
                </Button>
              </motion.div>
            )}
            {tab === "invoices" && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }}>
                <Button className="gap-2 rounded-xl group" onClick={openNewInvoice}>
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />{t("فاتورة جديدة", "New Invoice")}
                </Button>
              </motion.div>
            )}
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}>
              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setReportOpen(true)}>
                <BarChart3 className="w-4 h-4" />{t("تقارير", "Reports")}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants} className="relative flex flex-wrap gap-1 p-1 bg-muted/40 border border-border/50 rounded-xl w-full sm:w-fit">
        {([
          { id: "invoices" as SalesTab, label: t("الفواتير", "Invoices"), icon: <FileText className="w-3.5 h-3.5" /> },
          { id: "returns" as SalesTab, label: t("مردود المبيعات", "Sales Returns"), icon: <RotateCcw className="w-3.5 h-3.5" /> },
        ]).map(tabItem => (
          <motion.button key={tabItem.id} whileHover={{ y: -1, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }} whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
            onClick={() => { setTab(tabItem.id); setSearchQ(""); }}
            className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${tab === tabItem.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === tabItem.id && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-background shadow rounded-lg"
                transition={{ type: "spring", stiffness: 300, damping: 25 }} />
            )}
            <span className="relative z-[1] flex items-center gap-2">{tabItem.icon}{tabItem.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: t("إجمالي الفواتير", "Total Invoices"), value: fmtNum(summaryStats.totalInvoices), icon: FileText, color: "text-primary" },
          { label: t("إجمالي الإيرادات", "Total Revenue"), value: fmtCurrency(summaryStats.totalRevenue), icon: ShoppingCart, color: "text-emerald-500" },
          { label: t("معلق / متأخر", "Pending / Overdue"), value: fmtNum(summaryStats.pendingCount), icon: Clock, color: "text-amber-500" },
          { label: t("المرتجعات", "Returns"), value: `${fmtNum(summaryStats.returnsCount)} / ${fmtCurrency(summaryStats.returnsTotal)}`, icon: RotateCcw, color: "text-orange-500" },
        ].map(card => (
          <motion.div key={card.label} variants={itemVariants}
            whileHover={{ y: -3, boxShadow: "0 8px 25px rgba(0,0,0,0.1)" }} whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
            className="rounded-xl border border-border bg-card p-3 flex items-center gap-2.5 sm:gap-3 cursor-default">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 ${card.color}`}>
              <card.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{card.label}</p>
              <p className={`text-xs sm:text-sm font-bold truncate ${card.color}`}>{card.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Search & Filters */}
      <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card p-4 space-y-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.03),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("بحث برقم الفاتورة، اسم العميل، رقم الهاتف، كود العميل...", "Search by invoice#, customer name, phone, code...")}
                className="w-full pr-9 h-9 text-xs"
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
              />
            </div>
          </div>
        </div>
        {/* Filter context: result count + active chips */}
        {tab === "invoices" && (
          <motion.div layout className="flex items-center gap-2 flex-wrap text-xs">
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground/60">
              {filteredInvoices.length === invoices.length
                ? t(`عرض الكل (${invoices.length})`, `Showing all (${invoices.length})`)
                : t(`عرض ${filteredInvoices.length} من أصل ${invoices.length}`, `Showing ${filteredInvoices.length} of ${invoices.length}`)}
            </motion.span>
            {filterType !== "all" && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary/20">
                {filterType === "cash" ? t("نقدي", "Cash") : filterType === "credit" ? t("آجل", "Credit") : filterType === "wholesale" ? t("جملة", "Wholesale") : t("قطاعي", "Retail")}
                <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setFilterType("all")} />
              </motion.span>
            )}
            {filterStatus !== "all" && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] border border-amber-500/20">
                {filterStatus === "paid" ? t("مدفوع", "Paid") : filterStatus === "pending" ? t("معلق", "Pending") : t("متأخر", "Overdue")}
                <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setFilterStatus("all")} />
              </motion.span>
            )}
          </motion.div>
        )}
        {tab === "invoices" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
            className="relative flex flex-col gap-3">
          {/* Date filter - top row */}
          <motion.div layout className="flex items-center gap-1.5 flex-wrap bg-muted/20 p-1.5 rounded-lg border border-border/30">
            {(["all", "today", "custom"] as const).map(mode => (
              <motion.button key={mode} layout whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }} whileTap={{ y: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                onClick={() => { setDateMode(mode); if (mode !== "custom") { setDateFrom(""); setDateTo(""); } }}
                className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dateMode === mode ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {dateMode === mode && (
                  <motion.span layoutId="datePill" className="absolute inset-0 rounded-md bg-primary"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }} />
                )}
                <span className="relative z-[1] flex items-center gap-1.5">
                  {mode === "all" ? <CalendarDays className="w-3 h-3" /> : mode === "today" ? <Clock className="w-3 h-3" /> : <CalendarRange className="w-3 h-3" />}
                  {mode === "all" ? t("الكل", "All") : mode === "today" ? t("اليوم", "Today") : t("مخصص", "Custom")}
                </span>
              </motion.button>
            ))}
            <motion.div layout className="h-4 w-px bg-border mx-1" />
            {(dateMode === "all" && !dateFrom && !dateTo) ? (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-muted-foreground/50 px-1">
                {t("جميع الفواتير", "All invoices")}
              </motion.span>
            ) : dateMode === "today" ? (
              <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] text-muted-foreground/70 px-1">
                {todayStr}
              </motion.span>
            ) : null}
          </motion.div>

          <AnimatePresence mode="wait">
            {dateMode === "custom" && (
              <motion.div key="dateRange" initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 22 } }}
                exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.15 } }}
                className="flex items-center gap-2 p-2 bg-primary/[0.04] border border-primary/15 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground shrink-0 px-1">{t("من", "From")}</span>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="h-7 w-[135px] text-xs" />
                </div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 300 }}>
                  <ArrowLeftRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                </motion.div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground shrink-0 px-1">{t("إلى", "To")}</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="h-7 w-[135px] text-xs" />
                </div>
                {(dateFrom || dateTo) && (
                  <motion.button initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }} whileHover={{ scale: 1.15, rotate: 90 }}
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Separator */}
          <motion.div layout className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Type & Status - second row */}
          <motion.div layout className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider shrink-0">{t("النوع:", "Type:")}</span>
              <div className="flex gap-1 flex-wrap">
                {(["all", "cash", "credit", "wholesale", "retail"] as const).map(v => (
                  <motion.button key={v} layout whileHover={{ y: -2, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ y: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                    onClick={() => setFilterType(v)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${filterType === v
                      ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 border border-transparent"}`}>
                    {v === "all" ? t("الكل", "All") : v === "cash" ? t("نقدي", "Cash") : v === "credit" ? t("آجل", "Credit") : v === "wholesale" ? t("جملة", "Wholesale") : t("قطاعي", "Retail")}
                  </motion.button>
                ))}
              </div>
            </div>
            <div className="hidden sm:block h-4 w-px bg-border/50 shrink-0" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider shrink-0">{t("الحالة:", "Status:")}</span>
              <div className="flex gap-1 flex-wrap">
                {(["all", "paid", "pending", "overdue"] as const).map(v => (
                  <motion.button key={v} layout whileHover={{ y: -2, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ y: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                    onClick={() => setFilterStatus(v)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${filterStatus === v
                      ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 border border-transparent"}`}>
                    {v === "all" ? t("الكل", "All") : v === "paid" ? t("مدفوع", "Paid") : v === "pending" ? t("معلق", "Pending") : t("متأخر", "Overdue")}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
          </motion.div>
        )}
      </motion.div>

      {/* ── Invoices Table / Mobile Cards ── */}
      {tab === "invoices" && (
        <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Mobile card view */}
          <div className="block md:hidden divide-y divide-border">
            {filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">{t("لا توجد فواتير", "No invoices")}</p>
                {searchQ && <p className="text-xs mt-1 opacity-60">{t("حاول تغيير معايير البحث", "Try changing search criteria")}</p>}
              </div>
            ) : filteredInvoices.map(inv => {
              const typeColors: Record<string, string> = { cash: "border-l-emerald-500", credit: "border-l-amber-500", wholesale: "border-l-blue-500", retail: "border-l-purple-500" };
              const initials = inv.customerName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              const initialColors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500"];
              const initialColor = initialColors[inv.customerName.length % initialColors.length];
              return (
                <motion.div key={inv.id} variants={itemVariants} layout
                  className={`p-3 space-y-2 border-l-[3px] ${typeColors[inv.type] || "border-l-transparent"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-7 h-7 rounded-full ${initialColor} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>{initials}</div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate">{inv.customerName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{inv.customerPhone}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-primary font-medium shrink-0">{inv.id}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <TypeBadge type={inv.type} />
                      <StatusBadge status={inv.status} />
                    </div>
                    <span className="text-xs font-bold"><AnimatedNumber value={inv.total} /></span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{fmtDate(inv.date)}</span>
                    <div className="flex items-center gap-1">
                      <button className="flex items-center gap-1 text-primary hover:text-sky-500 transition-colors" onClick={() => handlePrintInvoice(inv)}>
                        <Download className="w-3 h-3" />
                      </button>
                      <button className="flex items-center gap-1 text-primary" onClick={() => { setDetailInv(inv); setDetailOpen(true); }}>
                        <FileText className="w-3 h-3" />
                        <span className="text-primary">{t("عرض", "View")}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="text-xs text-muted-foreground bg-gradient-to-r from-muted/80 via-muted/40 to-muted/80">
                  {[
                    { key: "id", label: t("رقم الفاتورة", "Invoice") },
                    { key: "customerName", label: t("العميل", "Customer") },
                    { key: "type", label: t("النوع", "Type"), hide: "md" },
                    { key: "date", label: t("التاريخ", "Date"), hide: "md" },
                    { key: "total", label: t("الإجمالي", "Total") },
                    { key: "status", label: t("الحالة", "Status") },
                    { key: null, label: t("إجراءات", "Actions"), center: true },
                  ].map(col => (
                    <th key={col.key || "actions"} onClick={() => col.key && setSortDir(prev => { setSortField(col.key); return prev === "asc" ? "desc" : "asc"; })}
                      className={`px-4 py-3 font-medium select-none ${col.center ? "text-center" : "text-start"} ${col.key ? "cursor-pointer hover:text-foreground transition-colors" : ""} ${col.hide === "md" ? "hidden md:table-cell" : ""}`}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.key && sortField === col.key && (
                          <motion.span initial={{ rotate: sortDir === "asc" ? 0 : 180 }} animate={{ rotate: sortDir === "asc" ? 0 : 180 }}
                            className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</motion.span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <FileText className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">{t("لا توجد فواتير", "No invoices")}</p>
                        {searchQ && <p className="text-xs mt-1 opacity-60">{t("حاول تغيير معايير البحث", "Try changing search criteria")}</p>}
                      </motion.div>
                    </td>
                  </tr>
                ) : filteredInvoices.map(inv => {
                  const typeColors: Record<string, string> = { cash: "border-l-emerald-500", credit: "border-l-amber-500", wholesale: "border-l-blue-500", retail: "border-l-purple-500" };
                  const initials = inv.customerName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  const initialColors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500"];
                  const initialColor = initialColors[inv.customerName.length % initialColors.length];
                  return (
                    <motion.tr variants={itemVariants} key={inv.id}
                      whileHover={{ backgroundColor: "hsl(var(--primary)/0.03)", scale: 1.001 }}
                      className={`border-b border-border/60 transition-colors cursor-default border-l-[3px] ${typeColors[inv.type] || "border-l-transparent"}`}
                      layout>
                      <td className="px-4 py-3 font-medium text-primary cursor-pointer hover:underline text-xs" onClick={() => { setDetailInv(inv); setDetailOpen(true); }}>{inv.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full ${initialColor} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm leading-tight truncate max-w-[180px]">{inv.customerName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{inv.customerPhone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell"><TypeBadge type={inv.type} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell">
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{fmtDate(inv.date)}</motion.span>
                      </td>
                      <td className="px-4 py-3 font-bold text-sm">
                        <AnimatedNumber value={inv.total} />
                        {inv.status !== "paid" && inv.paidAmount > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden max-w-[60px]">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(inv.paidAmount / inv.total) * 100}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground">{fmtNum(inv.paidAmount)}/{fmtNum(inv.total)}</span>
                          </div>
                        )}
                        {inv.status === "pending" && (!inv.paidAmount || inv.paidAmount <= 0) && (
                          <div className="text-[9px] text-muted-foreground/50 mt-0.5">{t("غير مدفوع", "Unpaid")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          {[
                            { icon: FileText, action: () => { setDetailInv(inv); setDetailOpen(true); }, color: "hover:text-primary", label: t("عرض", "View") },
                            { icon: Edit3, action: () => openEditInvoice(inv), color: "hover:text-amber-500", label: t("تعديل", "Edit"), disabled: !can("sales.edit") },
                            { icon: Download, action: () => handlePrintInvoice(inv), color: "hover:text-sky-500", label: t("طباعة", "Print") },
                            { icon: Trash2, action: () => handleDeleteInv(inv.id), color: "hover:text-destructive", label: t("حذف", "Delete"), disabled: !can("sales.delete") },
                          ].map(btn => (
                            <motion.div key={btn.label} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                              className="group/btn relative">
                              <Button variant="ghost" size="icon" className={`h-8 w-8 text-muted-foreground/50 ${btn.color} transition-colors`} onClick={btn.action} disabled={(btn as any).disabled}>
                                <motion.span
                                  whileHover={{ rotate: [0, -12, 12, -6, 0] }}
                                  transition={{ duration: 0.5, ease: "easeInOut" }}
                                  className="inline-flex">
                                  <btn.icon className="w-3.5 h-3.5" />
                                </motion.span>
                              </Button>
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded bg-popover text-popover-foreground border border-border shadow-sm opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                {btn.label}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
              {filteredInvoices.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20">
                    <td colSpan={4} className="px-4 py-3 text-xs text-muted-foreground font-medium">
                      {t("الإجمالي العام", "Grand Total")}
                    </td>
                    <td className="px-4 py-3 font-bold text-sm text-primary">
                      <AnimatedNumber value={filteredInvoices.reduce((s, i) => s + i.total, 0)} />
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Returns List ── */}
      {tab === "returns" && (
        <motion.div variants={cardVariants} className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Mobile card view */}
          <div className="block md:hidden divide-y divide-border">
            {filteredReturns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <RotateCcw className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">{t("لا توجد مرتجعات", "No returns")}</p>
              </div>
            ) : filteredReturns.map(ret => (
              <motion.div key={ret.id} variants={itemVariants} layout
                className="p-3 space-y-1.5 border-l-[3px] border-l-orange-400">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-orange-500">{ret.id}</span>
                  <span className="text-xs font-bold"><AnimatedNumber value={ret.total} /></span>
                </div>
                <p className="text-xs font-semibold">{ret.customerName}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{fmtDate(ret.date)}</span>
                  <span className="font-mono truncate max-w-[140px]">{ret.invoiceId || "—"}</span>
                </div>
                {ret.reason && <p className="text-[10px] text-muted-foreground truncate">{ret.reason}</p>}
              </motion.div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="text-xs text-muted-foreground bg-gradient-to-r from-muted/80 via-muted/40 to-muted/80">
                  <th className="px-4 py-3 font-medium">{t("رقم المرتجع", "Return#")}</th>
                  <th className="px-4 py-3 font-medium">{t("العميل", "Customer")}</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">{t("الفاتورة الأصلية", "Orig. Invoice")}</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">{t("التاريخ", "Date")}</th>
                  <th className="px-4 py-3 font-medium">{t("الإجمالي", "Total")}</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">{t("السبب", "Reason")}</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <RotateCcw className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">{t("لا توجد مرتجعات", "No returns")}</p>
                      </motion.div>
                    </td>
                  </tr>
                ) : filteredReturns.map(ret => (
                  <motion.tr variants={itemVariants} key={ret.id}
                    whileHover={{ backgroundColor: "hsl(var(--primary)/0.03)", scale: 1.001 }}
                    className="border-b border-border/60 transition-colors cursor-default border-l-[3px] border-l-orange-400" layout>
                    <td className="px-4 py-3 font-medium text-orange-500 text-xs">{ret.id}</td>
                    <td className="px-4 py-3 font-semibold text-sm">{ret.customerName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden md:table-cell">{ret.invoiceId || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{fmtDate(ret.date)}</td>
                    <td className="px-4 py-3 font-bold text-sm"><AnimatedNumber value={ret.total} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate hidden lg:table-cell">{ret.reason || "—"}</td>
                  </motion.tr>
                ))}
              </motion.tbody>
              {filteredReturns.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20">
                    <td colSpan={4} className="px-4 py-3 text-xs text-muted-foreground font-medium">
                      {t("الإجمالي العام", "Grand Total")}
                    </td>
                    <td className="px-4 py-3 font-bold text-sm text-primary">
                      <AnimatedNumber value={filteredReturns.reduce((s, r) => s + r.total, 0)} />
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Create/Edit Invoice Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={v => { setSheetOpen(v); if (!v) resetForm(); }}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingId ? t("تعديل الفاتورة", "Edit Invoice") : t("فاتورة جديدة", "New Invoice")}</SheetTitle>
            <SheetDescription>{editingId ? t("تعديل بيانات الفاتورة", "Edit invoice details") : t("أدخل بيانات الفاتورة والمنتجات", "Enter invoice & product details")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            {/* Customer */}
            <div className="space-y-2">
              <Label>{t("العميل", "Customer")}</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={t("ابحث بالاسم أو رقم الهاتف أو الكود...", "Search by name, phone, or code...")}
                    className="pr-9 h-9 text-xs"
                    value={formCustId ? (customers.find(c => c.id === formCustId)?.name || custSearch) : custSearch}
                    onChange={e => {
                      const v = e.target.value;
                      setCustSearch(v);
                      const match = customers.find(c => c.name === v || c.phone === v || c.code === v);
                      setFormCustId(match ? match.id : "");
                    }}
                    onFocus={e => e.target.select()}
                  />
                  {custSearch && !formCustId && customers.filter(c => c.name.includes(custSearch) || c.phone.includes(custSearch) || c.code.includes(custSearch)).length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border rounded-lg bg-popover shadow-lg max-h-[180px] overflow-y-auto divide-y divide-border">
                      {customers.filter(c => c.name.includes(custSearch) || c.phone.includes(custSearch) || c.code.includes(custSearch)).slice(0, 8).map(c => (
                        <button key={c.id} type="button" onClick={() => { setFormCustId(c.id); setCustSearch(""); }}
                          className="w-full text-start px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2">
                          <Store className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-foreground">{c.name}</span>
                          <span className="text-muted-foreground" dir="ltr">{c.phone}</span>
                          <span className="text-[10px] text-muted-foreground/50 font-mono">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setNewCustOpen(true)} title={t("إضافة عميل جديد", "Add new customer")}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
              {formCustId && (() => {
                const c = customers.find(c => c.id === formCustId);
                return c ? (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 flex-wrap">
                    <Store className="w-3.5 h-3.5" /><span className="font-semibold text-foreground">{c.name}</span>
                    <Phone className="w-3 h-3 me-1 ms-2" /><span dir="ltr">{c.phone}</span>
                    {c.phone2 && <><Phone className="w-3 h-3 me-1 ms-2" /><span dir="ltr">{c.phone2}</span></>}
                    <Hash className="w-3 h-3 me-1 ms-2" /><span>{c.code}</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Type & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("نوع الفاتورة", "Invoice Type")}</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={t("اختر النوع", "Select type")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">{t("آجل", "Credit")}</SelectItem>
                    <SelectItem value="wholesale">{t("جملة", "Wholesale")}</SelectItem>
                    <SelectItem value="retail">{t("قطاعي", "Retail")}</SelectItem>
                    <SelectItem value="cash">{t("نقدي", "Cash")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("الحالة", "Status")}</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={t("اختر الحالة", "Select status")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">{t("مدفوع", "Paid")}</SelectItem>
                    <SelectItem value="pending">{t("معلق", "Pending")}</SelectItem>
                    <SelectItem value="overdue">{t("متأخر", "Overdue")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Marketer (optional) */}
            {marketers.length > 0 && (
              <div className="space-y-2">
                <Label>{t("مندوب التسويق", "Marketer")}</Label>
                <Select value={formMarketerId || "__none__"} onValueChange={v => setFormMarketerId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={t("بدون مندوب", "No marketer")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("بدون مندوب", "No marketer")}</SelectItem>
                    {marketers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Delivery toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/10 p-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold">{t("توصيل", "Delivery")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("هل سيتم توصيل الفاتورة؟", "Will this invoice be delivered?")}</p>
                </div>
              </div>
              <button type="button" onClick={() => { const on = !formNeedsDelivery; setFormNeedsDelivery(on); if (on && formCustId) { const cust = customers.find(c => c.id === formCustId); if (cust) { const saved = cust.savedAddresses || []; const last = saved.length > 0 ? saved[saved.length - 1] : null; setFormDelGov(last?.governorate || cust.governorate || ""); setFormDelRegion(last?.region || cust.region || ""); setFormDelVillage(last?.village || ""); setFormDelDetailsTags(last?.details || []); } } }}
                className={`relative w-11 h-6 rounded-full transition-colors ${formNeedsDelivery ? "bg-primary" : "bg-muted-foreground/30"}`}>
                <motion.div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ left: formNeedsDelivery ? "22px" : "2px" }} />
              </button>
            </div>

            {/* Delivery address (smart) */}
            {formNeedsDelivery && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {t("عنوان التوصيل", "Delivery Address")}
                </div>

                {/* Saved addresses quick-select */}
                {formCustId && (() => {
                  const cust = customers.find(c => c.id === formCustId);
                  const saved = cust?.savedAddresses || [];
                  if (saved.length === 0) return null;
                  return (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{t("عناوين سابقة", "Saved Addresses")}</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {saved.map((addr, i) => (
                          <button key={i} type="button" onClick={() => { setFormDelGov(addr.governorate); setFormDelRegion(addr.region); setFormDelVillage(addr.village || ""); setFormDelDetailsTags(addr.details); }}
                            className="px-2 py-1 rounded-md border border-border/60 text-[10px] hover:bg-primary/5 hover:border-primary/30 transition-colors">
                            {addr.governorate} — {addr.region}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Merge default GOVERNORATES with custom ones from store */}
                {(() => {
                  const allGovs = Object.keys(GOVERNORATES);
                  const customGovNames = Object.keys(customRegions).filter(g => !allGovs.includes(g));
                  const mergedGovs = [...allGovs, ...customGovNames];

                  const getRegions = (gov: string) => {
                    const defaultRegs = GOVERNORATES[gov] || [];
                    const customRegs = customRegions[gov] || [];
                    const merged = [...defaultRegs];
                    for (const r of customRegs) { if (!merged.includes(r)) merged.push(r); }
                    return merged;
                  };

                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t("المحافظة", "Governorate")}</Label>
                        <SearchableSelect value={formDelGov} onChange={v => { setFormDelGov(v); setFormDelRegion(""); }}
                          options={mergedGovs} placeholder={t("اختر المحافظة", "Select governorate")}
                          onAddNew={(name) => { if (!customRegions[name]) { addCustomRegion(name, "مركز"); } }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t("المنطقة / المدينة", "Region / City")}</Label>
                        <SearchableSelect value={formDelRegion} onChange={setFormDelRegion}
                          options={formDelGov ? getRegions(formDelGov) : []}
                          placeholder={t("اختر المنطقة", "Select region")}
                          emptyText={formDelGov ? t("لا توجد مناطق", "No regions") : t("اختر المحافظة أولاً", "Select governorate first")}
                          onAddNew={formDelGov ? ((name) => addCustomRegion(formDelGov, name)) : undefined} />
                      </div>
                    </div>
                  );
                })()}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("القرية (اختياري)", "Village (optional)")}</Label>
                  <SearchableSelect value={formDelVillage} onChange={setFormDelVillage}
                    options={formDelGov ? (GOVERNORATES[formDelGov] || []) : []}
                    placeholder={t("اختر القرية", "Select village")}
                    emptyText={t("غير محدد", "Not specified")}
                    onAddNew={formDelGov ? ((name) => addCustomRegion(formDelGov, name)) : undefined} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("تفاصيل العنوان (وسوم)", "Address Details (Tags)")}</Label>
                  <TagsInput tags={formDelDetailsTags} onChange={setFormDelDetailsTags} placeholder={t("مثال: شارع الثورة - عمارة 5", "e.g. Street - Building")} />
                </div>
              </motion.div>
            )}

            {/* Payment method (shown when paid) */}
            {formStatus === "paid" && (
              <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3">
                <Label className="text-xs font-semibold">{t("طريقة الدفع", "Payment Method")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "cash", label: t("نقدي", "Cash") },
                    { id: "bank_transfer", label: t("تحويل بنكي", "Bank Transfer") },
                    { id: "vodafone_cash", label: t("فودافون كاش", "Vodafone Cash") },
                    { id: "instapay", label: t("انستا باي", "InstaPay") },
                  ].map(m => (
                    <button key={m.id} type="button" onClick={() => { setFormPayMethod(m.id); if (m.id !== "bank_transfer") setFormPayBank(""); }}
                      className={`flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-medium transition-all ${formPayMethod === m.id ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {formPayMethod !== "cash" && (
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold">
                      {formPayMethod === "bank_transfer" ? t("البنك", "Bank")
                        : formPayMethod === "vodafone_cash" ? t("رقم محفظة فودافون", "Vodafone Wallet")
                        : t("رقم حساب انستا باي", "InstaPay Account")}
                    </Label>
                    <Select value={formPayBank} onValueChange={setFormPayBank}>
                      <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue placeholder={t("اختر", "Select")} /></SelectTrigger>
                      <SelectContent>
                        {formPayMethod === "bank_transfer" && bankAccounts.map(b => (
                          <SelectItem key={b.id} value={b.id}><span>{b.name}</span></SelectItem>
                        ))}
                        {(formPayMethod === "vodafone_cash" || formPayMethod === "instapay") && walletAccounts.filter(w => w.type === formPayMethod).map(w => (
                          <SelectItem key={w.id} value={w.id}><span>{w.name} — {w.identifier}</span></SelectItem>
                        ))}
                        {(formPayMethod === "vodafone_cash" || formPayMethod === "instapay") && walletAccounts.filter(w => w.type === formPayMethod).length === 0 && (
                          <SelectItem value="__none__" disabled>{t("غير مسجل في الحسابات", "Not registered in Accounting")}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {(formPayMethod === "vodafone_cash" || formPayMethod === "instapay") && formPayBank && (() => {
                      const wal = walletAccounts.find(w => w.id === formPayBank);
                      const amt = parseFloat(formPaidAmount) || 0;
                      if (!wal || !wal.maxLimit || amt <= 0) return null;
                      if (amt > wal.maxLimit - wal.balance) {
                        return (
                          <p className="flex items-center gap-1 text-[9px] text-destructive mt-1">
                            <AlertTriangle className="w-3 h-3"/>{t("تجاوز الحد الأقصى للمحفظة", "Wallet max limit exceeded")} ({fmtNum(wal.maxLimit)} ج.م)
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            )}

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
                        <motion.div layoutId="pricingActive" transition={{ type: "spring", stiffness: 300, damping: 28 }}
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

            {/* Items */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label>{t("المنتجات", "Products")}</Label>
                <motion.div whileHover={{ y: -1, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                  <Button variant="outline" size="sm" onClick={addItem} className="gap-1 h-8"><Plus className="w-3 h-3" />{t("إضافة", "Add")}</Button>
                </motion.div>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {formItems.map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="rounded-xl border border-border p-3 space-y-2">
                      {simpleInvoiceItems ? (
                        /* ── Simple mode (name + qty + price) ── */
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <Label className="text-xs">{t("اسم الصنف", "Product")} {i + 1}</Label>
                            <SmartInput field="product-name"
                              value={item.productName}
                              onChange={v => updateItem(i, "productName", v)}
                              placeholder={t("اسم الصنف...", "Product name...")}
                              extraSuggestions={[...products.map(p => p.name), ...getFeedTermSuggestions()]}
                            />
                          </div>
                          <div className="w-20 space-y-2">
                            <Label className="text-xs">{t("الكمية", "Qty")}</Label>
                            <Input type="number" min={0} value={item.qtyTons || ""} onChange={e => updateItem(i, "qtyTons", Math.max(0, Number(e.target.value)))} />
                          </div>
                          <div className="w-24 space-y-2">
                            <Label className="text-xs">{t("السعر", "Price")}</Label>
                            <Input type="number" min={0} value={item.pricePerTon || ""} onChange={e => updateItem(i, "pricePerTon", Math.max(0, Number(e.target.value)))} />
                          </div>
                          {formItems.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 mt-5 text-destructive" onClick={() => removeItem(i)}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        /* ── Complex mode (full product search + units + bags) ── */
                        <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1 sm:col-span-1">
                          <Label className="text-xs text-muted-foreground">{t("المنتج", "Product")}</Label>
                          <Popover open={prodPopoverIdx === i} onOpenChange={open => setProdPopoverIdx(open ? i : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" aria-expanded={prodPopoverIdx === i}
                                className="w-full h-8 text-xs justify-between rounded-md font-normal">
                                {item.productId
                                  ? (products.find(p => p.id === item.productId)?.name || item.productName)
                                  : t("اختر...", "Select...")}
                                <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[280px] p-0">
                              <Command>
                                <CommandInput placeholder={t("ابحث عن منتج...", "Search product...")} className="h-8 text-xs" />
                                <CommandList>
                                  <CommandEmpty className="text-xs py-2">{t("لا توجد نتائج", "No results")}</CommandEmpty>
                                  <CommandGroup>
                                    {products.map(p => (
                                      <CommandItem key={p.id} value={`${p.name} ${p.code} ${p.id}`}
                                        onSelect={() => { updateItem(i, "productId", p.id); setProdPopoverIdx(null); }}
                                        className="text-xs">
                                        <Check className={cn("w-3.5 h-3.5 me-2", item.productId === p.id ? "opacity-100" : "opacity-0")} />
                                        <span className="flex-1">{p.name}</span>
                                        <span className="text-[9px] text-muted-foreground">{p.code}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t("الكمية", "Qty")} ({getBaseUnitLabel(productConfig, language)})</Label>
                          <div className="flex items-center gap-1">
                            <Input type="number" min="0" step="0.001" className="h-8 text-xs" value={item.qtyTons || ""} onChange={e => updateItem(i, "qtyTons", parseFloat(e.target.value) || 0)} />
                            <Scale className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t("السعر", "Price")}/{getBaseUnitLabel(productConfig, language)}</Label>
                          <div className="flex items-center gap-1">
                            <Input type="number" min="0" className="h-8 text-xs flex-1" value={item.pricePerTon || ""} onChange={e => updateItem(i, "pricePerTon", parseFloat(e.target.value) || 0)} />
                            {item.productId && !item.pricePerTon && (
                              <span className="text-[9px] text-destructive font-semibold whitespace-nowrap bg-destructive/10 px-1.5 py-1 rounded">{t("لم يسعر", "No Price")}</span>
                            )}
                          </div>
                          {item.productId && (() => {
                            const costPrice = getCostPrice(item.productId);
                            if (!costPrice) return null;
                            const margin = item.pricePerTon ? Math.round((item.pricePerTon - costPrice) / costPrice * 100) : 0;
                            const profit = item.pricePerTon ? item.pricePerTon - costPrice : 0;
                            return (
                              <div className="flex items-center gap-2 text-[9px]">
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/10 text-orange-600 rounded cursor-default" title={t("تكلفة المنتج", "Product cost")}>
                                  <span>{t("تكلفة", "Cost")}:</span>
                                  <span className="font-semibold">{fmtCurrency(costPrice)}</span>
                                </div>
                                {item.pricePerTon > 0 && (
                                  <div className={`px-1.5 py-0.5 rounded font-medium ${margin >= 20 ? "bg-emerald-500/10 text-emerald-600" : margin >= 10 ? "bg-amber-500/10 text-amber-600" : margin < 0 ? "bg-destructive/20 text-destructive flex items-center gap-1" : "bg-destructive/10 text-destructive"}`}>
                                    {margin < 0 ? <AlertTriangle className="w-2.5 h-2.5" /> : null}
                                    {t(`هامش ${margin}%`, `${margin}% margin`)} · {fmtCurrency(profit)}
                                  </div>
                                )}
                                {(!item.pricePerTon || item.pricePerTon === 0) && (
                                  <MarginSelector costPrice={costPrice} onSelect={p => updateItem(i, "pricePerTon", p)} t={t} />
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {productConfig.showPackageWeight && (<>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t("وزن الشيكارة", "Bag Wt")} ({getUnitLabel(productConfig, "kg", language)})</Label>
                          <div className="flex gap-1">
                            <Input type="number" min="1" className="h-8 w-[72px] text-xs" value={item.bagWeight || ""} onChange={e => { const w = parseInt(e.target.value) || 0; updateItem(i, "bagWeight", w > 0 ? w : 50); }} />
                            <div className="flex gap-0.5">
                              {(productConfig.packageWeightPresets || BAG_WEIGHTS_DEFAULT).map(w => (
                                <motion.button key={w} type="button" layout
                                  whileHover={{ y: -2, boxShadow: "0 3px 8px rgba(0,0,0,0.1)" }}
                                  whileTap={{ scale: 0.9, y: 0 }}
                                  transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                                  onClick={() => updateItem(i, "bagWeight", w)}
                                  className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${item.bagWeight === w ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                                  {w}
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        </div>
                        </>)}
                        {productConfig.showPackageCount && (<>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t("عدد الشكاير", "Bag Count")}</Label>
                          <Input type="number" min="0" className="h-8 text-xs" value={item.bagCount || ""} onChange={e => updateItem(i, "bagCount", parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1 flex items-end">
                          <span className="text-xs text-muted-foreground pb-1.5">
                            {item.qtyTons > 0 && item.bagWeight > 0 && (
                              <span className="font-medium text-foreground">
                                = {fmtNum(Math.round((item.qtyTons * 1000) / item.bagWeight))} {getUnitLabel(productConfig, "bag", language)}
                              </span>
                            )}
                          </span>
                        </div>
                        </>)}
                      </div>
                      {formItems.length > 1 && (
                        <motion.div whileHover={{ y: -1, boxShadow: "0 2px 8px rgba(220,38,38,0.1)" }} whileTap={{ scale: 0.92 }}
                          transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive gap-1" onClick={() => removeItem(i)}>
                            <Trash2 className="w-3 h-3" />{t("إزالة", "Remove")}
                          </Button>
                        </motion.div>
                      )}
                      </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Discount & Tax */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("الخصم %", "Discount %")}</Label>
                <Input type="number" min="0" max="100" className="h-9" value={formDiscount} onChange={e => setFormDiscount(e.target.value)} />
                {parseFloat(formDiscount) > maxDiscountPercent && (
                  <p className="text-[10px] text-destructive">{t("تجاوز الحد الأقصى للخصم", "Exceeds max discount")} ({maxDiscountPercent}%)</p>
                )}
              </div>
              {taxEnabled && (
                <div className="space-y-2">
                  <Label>{t("الضريبة %", "Tax %")}</Label>
                  <Input type="number" min="0" max="100" className="h-9" value={taxPercent} readOnly disabled />
                  <p className="text-[10px] text-muted-foreground">{t("قيمة ثابتة من الإعدادات", "Fixed from Settings")}</p>
                </div>
              )}
            </div>

            {/* Additional charges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("إضافات", "Additions")}</Label>
                <Input type="number" min="0" className="h-9" value={formCharges} onChange={e => setFormCharges(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>{t("بيان الإضافة", "Addition Description")}</Label>
                <Input className="h-9" value={formChargesDesc} onChange={e => setFormChargesDesc(e.target.value)} placeholder={t("مثل: نقل، تحميل...", "e.g. delivery, loading...")} />
              </div>
            </div>

            {/* Totals */}
            {subtotal > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("المجموع الجزئي", "Subtotal")}</span><span>{fmtCurrency(subtotal)}</span></div>
                {discountAmt > 0 && <div className="flex justify-between text-destructive"><span>{t("خصم", "Discount")} {formDiscount}%</span><span>- {fmtCurrency(discountAmt)}</span></div>}
                {taxAmt > 0 && <div className="flex justify-between text-amber-500"><span>{t("ضريبة", "Tax")} {taxPercent}%</span><span>+ {fmtCurrency(taxAmt)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-2">
                  <span>{t("الإجمالي", "Total")}</span><span className="text-primary">{fmtCurrency(total)}</span>
                </div>
                {chargesAmount > 0 && (
                  <>
                    <div className="flex justify-between text-blue-500 text-xs pt-1">
                      <span>{t("إضافات", "Additions")}{formChargesDesc ? ` (${formChargesDesc})` : ""}</span>
                      <span>+ {fmtCurrency(chargesAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm border-t border-border/50 pt-1.5 mt-1">
                      <span>{t("الصافي", "Net Total")}</span><span className="text-primary">{fmtCurrency(grandTotal)}</span>
                    </div>
                  </>
                )}
                <Separator className="my-1" />
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold">{t("المدفوع", "Paid")}</Label>
                  <Input type="number" min="0" step="0.01" className="h-8 text-xs text-center rounded-lg"
                    placeholder={t("المدفوع", "Paid")} value={formPaidAmount}
                    onChange={e => { setFormPaidAmount(e.target.value); setExcessCredit(false); }} />
                </div>
                {excessAmount > 0 ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t("الزيادة عن المطلوب", "Excess")}</span>
                      <span className="font-semibold text-amber-500">+{fmtCurrency(excessAmount)}</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={excessCredit} onChange={e => setExcessCredit(e.target.checked)}
                        className="rounded border-border accent-primary" />
                      <span className="text-[10px]">{t("خصم الزيادة من ديون العميل", "Deduct excess from customer debt")}</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-muted-foreground">{t("المتبقي", "Remaining")}</span>
                    <span className={`font-semibold ${remaining > 0 ? "text-destructive" : "text-emerald-500"}`}>
                      {remaining > 0 ? fmtCurrency(remaining) : t("---", "---")}
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-3 py-3">
                  <div className="flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-600 rounded-xl py-3">
                    <CheckCircle2 className="w-5 h-5" /><span className="font-medium">{editingId ? t("تم التعديل!", "Updated!") : t("تم إنشاء الفاتورة!", "Created!")}</span>
                  </div>
                  {lastCreatedInv && (
                    <Button variant="outline" className="w-full gap-2 rounded-xl" onClick={() => { handlePrintInvoice(lastCreatedInv); }}>
                      <Download className="w-4 h-4" />{t("طباعة الفاتورة", "Print Invoice")}
                    </Button>
                  )}
                </motion.div>
              ) : (
                <motion.div key="b" className="flex gap-3">
                  <motion.div whileHover={{ y: -1, boxShadow: "0 4px 15px rgba(0,0,0,0.08)" }} whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                    <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={!formCustId || !formType || formItems.some(i => !i.productId || i.qtyTons <= 0)}>
                      {editingId ? t("حفظ التعديل", "Save Changes") : t("إنشاء الفاتورة", "Create Invoice")}
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ y: -1, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }} whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                    <Button variant="outline" className="rounded-xl" onClick={() => { setSheetOpen(false); resetForm(); }}>{t("إلغاء", "Cancel")}</Button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Create Return Sheet ── */}
      <Sheet open={returnOpen} onOpenChange={v => { if (!v) { setReturnOpen(false); setRetCustId(""); setRetCustSearch(""); setRetInvSearch(""); setRetDiscount("0"); setRetReason(""); setRetInvId(""); setRetItems([{ productId: "", productName: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }]); } }}>
        <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{t("تسجيل مردود مبيعات", "Record Sales Return")}</SheetTitle>
            <SheetDescription>{t("إرجاع منتجات من العميل وإضافتها للمخزون", "Return products from customer, add back to inventory")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("العميل", "Customer")}</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={t("ابحث بالاسم أو رقم الهاتف أو الكود...", "Search by name, phone, or code...")}
                  className="pr-9 h-9 text-xs"
                  value={retCustId ? (customers.find(c => c.id === retCustId)?.name || retCustSearch) : retCustSearch}
                  onChange={e => {
                    const v = e.target.value;
                    setRetCustSearch(v);
                    const match = customers.find(c => c.name === v || c.phone === v || c.code === v);
                    setRetCustId(match ? match.id : "");
                  }}
                  onFocus={e => e.target.select()}
                />
                {retCustSearch && !retCustId && customers.filter(c => c.name.includes(retCustSearch) || c.phone.includes(retCustSearch) || c.code.includes(retCustSearch)).length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border rounded-lg bg-popover shadow-lg max-h-[180px] overflow-y-auto divide-y divide-border">
                    {customers.filter(c => c.name.includes(retCustSearch) || c.phone.includes(retCustSearch) || c.code.includes(retCustSearch)).slice(0, 8).map(c => (
                      <button key={c.id} type="button" onClick={() => { setRetCustId(c.id); setRetCustSearch(""); }}
                        className="w-full text-start px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2">
                        <Store className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <span className="text-muted-foreground" dir="ltr">{c.phone}</span>
                        <span className="text-[10px] text-muted-foreground/50 font-mono">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {retCustId && (() => {
                const c = customers.find(c => c.id === retCustId);
                return c ? (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 flex-wrap">
                    <Store className="w-3.5 h-3.5" /><span className="font-semibold text-foreground">{c.name}</span>
                    <Phone className="w-3 h-3 me-1 ms-2" /><span dir="ltr">{c.phone}</span>
                    <Hash className="w-3 h-3 me-1 ms-2" /><span>{c.code}</span>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("الفاتورة الأصلية (اختياري)", "Original Invoice (opt.)")}</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={t("ابحث أو اكتب كود الفاتورة", "Search or type invoice code")}
                    className="pr-9 h-9 text-xs"
                    value={retInvId && !retInvSearch ? retInvId : retInvSearch}
                    onChange={e => {
                      const v = e.target.value;
                      setRetInvSearch(v);
                      const match = invoices.find(i => i.id === v);
                      setRetInvId(match ? match.id : v);
                    }}
                    onFocus={e => e.target.select()}
                  />
                </div>
                {retInvSearch && !retInvId && invoices.filter(i => !retCustId || i.customerId === retCustId).filter(i => i.id.includes(retInvSearch)).length > 0 && (
                  <div className="border border-border rounded-lg mt-1 max-h-[140px] overflow-y-auto divide-y divide-border">
                    {invoices.filter(i => !retCustId || i.customerId === retCustId).filter(i => i.id.includes(retInvSearch)).slice(0, 8).map(inv => (
                      <button key={inv.id} type="button" onClick={() => { setRetInvId(inv.id); setRetInvSearch(""); }}
                        className="w-full text-start px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors">
                        <span className="font-medium text-primary">{inv.id}</span>
                        <span className="text-muted-foreground mx-2">—</span>
                        <span>{inv.customerName}</span>
                        <span className="text-muted-foreground mx-2">|</span>
                        <span className="font-medium">{fmtCurrency(inv.total)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("سبب الإرجاع", "Return Reason")}</Label>
                <Input className="h-9 text-xs" value={retReason} onChange={e => setRetReason(e.target.value)} placeholder={t("اختياري", "Optional")} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label>{t("المنتجات المرتجعة", "Returned Products")}</Label>
                <motion.div whileHover={{ y: -1, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }} whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                  <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => setRetItems(prev => [...prev, { productId: "", productName: "", qtyTons: 0, bagWeight: 50, bagCount: 0, pricePerTon: 0 }])}>
                    <Plus className="w-3 h-3" />{t("إضافة", "Add")}
                  </Button>
                </motion.div>
              </div>
              <div className="space-y-3">
                {retItems.map((item, i) => (
                  <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1 sm:col-span-1">
                        <Label className="text-xs text-muted-foreground">{t("المنتج", "Product")}</Label>
                        <Popover open={retProdPopoverIdx === i} onOpenChange={open => setRetProdPopoverIdx(open ? i : null)}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={retProdPopoverIdx === i}
                              className="w-full h-8 text-xs justify-between rounded-md font-normal">
                              {item.productId
                                ? (products.find(p => p.id === item.productId)?.name || item.productName)
                                : t("اختر...", "Select...")}
                              <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-[280px] p-0">
                            <Command>
                              <CommandInput placeholder={t("ابحث عن منتج...", "Search product...")} className="h-8 text-xs" />
                              <CommandList>
                                <CommandEmpty className="text-xs py-2">{t("لا توجد نتائج", "No results")}</CommandEmpty>
                                <CommandGroup>
                                  {products.map(p => (
                                    <CommandItem key={p.id} value={`${p.name} ${p.code} ${p.id}`}
                                      onSelect={() => {
                                        setRetItems(prev => prev.map((it, idx) => idx === i ? { ...it, productId: p.id, productName: p.name, pricePerTon: getPrice(p.id, "wholesale") || p.wholeSalePrice || 0, bagWeight: p.bagWeight || 50 } : it));
                                        setRetProdPopoverIdx(null);
                                      }}
                                      className="text-xs">
                                      <Check className={cn("w-3.5 h-3.5 me-2", item.productId === p.id ? "opacity-100" : "opacity-0")} />
                                      <span className="flex-1">{p.name}</span>
                                      <span className="text-[9px] text-muted-foreground">{p.code}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("الكمية", "Qty")} ({getBaseUnitLabel(productConfig, language)})</Label>
                        <div className="flex items-center gap-1">
                          <Input type="number" min="0" step="0.001" className="h-8 text-xs" value={item.qtyTons || ""} onChange={e => setRetItems(prev => prev.map((it, idx) => idx === i ? { ...it, qtyTons: parseFloat(e.target.value) || 0, bagCount: it.bagWeight > 0 ? Math.round((parseFloat(e.target.value) || 0) * 1000 / it.bagWeight) : 0 } : it))} />
                          <Scale className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("السعر", "Price")}/{getBaseUnitLabel(productConfig, language)}</Label>
                        <Input type="number" min="0" className="h-8 text-xs" value={item.pricePerTon || ""} onChange={e => setRetItems(prev => prev.map((it, idx) => idx === i ? { ...it, pricePerTon: parseFloat(e.target.value) || 0 } : it))} />
                      </div>
                      {productConfig.showPackageWeight && (<>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("وزن الشيكارة", "Bag Wt")} ({getUnitLabel(productConfig, "kg", language)})</Label>
                        <div className="flex gap-1">
                          <Input type="number" min="1" className="h-8 w-[72px] text-xs" value={item.bagWeight || ""} onChange={e => { const w = parseInt(e.target.value) || 0; setRetItems(prev => prev.map((it, idx) => idx === i ? { ...it, bagWeight: w > 0 ? w : 50, bagCount: it.qtyTons > 0 ? Math.round((it.qtyTons * 1000) / (w > 0 ? w : 50)) : it.bagCount } : it)); }} />
                          <div className="flex gap-0.5">
                            {(productConfig.packageWeightPresets || BAG_WEIGHTS_DEFAULT).map(w => (
                              <motion.button key={w} type="button" layout
                                whileHover={{ y: -2, boxShadow: "0 3px 8px rgba(0,0,0,0.1)" }}
                                whileTap={{ scale: 0.9, y: 0 }}
                                transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}
                                onClick={() => setRetItems(prev => prev.map((it, idx) => idx === i ? { ...it, bagWeight: w, bagCount: it.qtyTons > 0 ? Math.round((it.qtyTons * 1000) / w) : it.bagCount } : it))}
                                className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${item.bagWeight === w ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                                {w}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      </div>
                      </>)}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {productConfig.showPackageCount && (<>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("عدد الشكاير", "Bag Count")}</Label>
                        <Input type="number" min="0" className="h-8 text-xs" value={item.bagCount || ""} onChange={e => setRetItems(prev => prev.map((it, idx) => idx === i ? { ...it, bagCount: parseInt(e.target.value) || 0, qtyTons: it.bagWeight > 0 ? +(((parseInt(e.target.value) || 0) * it.bagWeight) / 1000).toFixed(3) : 0 } : it))} />
                      </div>
                      <div className="space-y-1 flex items-end">
                        <span className="text-xs text-muted-foreground pb-1.5">
                          {item.qtyTons > 0 && item.bagWeight > 0 && (
                            <span className="font-medium text-foreground">
                              = {fmtNum(Math.round((item.qtyTons * 1000) / item.bagWeight))} {getUnitLabel(productConfig, "bag", language)}
                            </span>
                          )}
                        </span>
                      </div>
                      </>)}
                      </div>
                    {retItems.length > 1 && (
                      <motion.div whileHover={{ y: -1, boxShadow: "0 2px 8px rgba(220,38,38,0.1)" }} whileTap={{ scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive gap-1" onClick={() => setRetItems(prev => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 className="w-3 h-3" />{t("إزالة", "Remove")}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Separator className="my-1" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("الخصم %", "Discount %")}</Label>
                  <div className="flex items-center gap-1">
                    <Input type="number" min="0" max="100" step="0.1" className="h-8 text-xs" value={retDiscount} onChange={e => setRetDiscount(e.target.value)} />
                    <Badge variant="outline" className="h-5 px-1 text-[10px]">%</Badge>
                  </div>
                  {(() => {
                    const sub = retItems.reduce((s, i) => s + i.qtyTons * i.pricePerTon, 0);
                    const dp = parseFloat(retDiscount) || 0;
                    const maxDisc = maxDiscountPercent ?? 0;
                    if (dp > 0 && maxDisc > 0 && dp > maxDisc) return <p className="text-[10px] text-destructive mt-0.5">{t("يتجاوز الحد المسموح", "Exceeds max allowed")} ({maxDisc}%)</p>;
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
                const sub = retItems.reduce((s, i) => s + i.qtyTons * i.pricePerTon, 0);
                const dp = parseFloat(retDiscount) || 0;
                const da = sub * dp / 100;
                const tp = taxEnabled ? taxPercent : 0;
                const ta = tp > 0 ? (sub - da) * tp / 100 : 0;
                const total = sub - da + ta;
                return (
                  <div className="rounded-lg bg-muted/50 p-2.5 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("الإجمالي", "Subtotal")}</span><span className="font-medium">{fmtNum(sub)} {t("ج.م", "EGP")}</span></div>
                    {dp > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("الخصم", "Discount")} ({dp}%)</span><span className="font-medium text-destructive">-{fmtNum(da)} {t("ج.م", "EGP")}</span></div>}
                    {tp > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("الضريبة", "Tax")} ({tp}%)</span><span className="font-medium">+{fmtNum(ta)} {t("ج.م", "EGP")}</span></div>}
                    <Separator />
                    <div className="flex justify-between text-sm"><span className="font-semibold">{t("الصافي", "Total")}</span><span className="font-bold text-primary">{fmtNum(total)} {t("ج.م", "EGP")}</span></div>
                  </div>
                );
              })()}
            </div>
            <motion.div whileHover={{ y: -1, boxShadow: "0 4px 15px rgba(0,0,0,0.08)" }} whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 250, damping: 22, mass: 0.8 }}>
              <Button className="w-full gap-2 rounded-xl" onClick={handleSubmitReturn} disabled={!retCustId || retItems.some(i => !i.productId || i.qtyTons <= 0)}>
                <RotateCcw className="w-4 h-4" />{t("تسجيل المرتجع", "Record Return")}
              </Button>
            </motion.div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
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
                <div className="flex items-center gap-2"><TypeBadge type={detailInv.type} />
                  {detailInv.pricingTier && detailInv.pricingTier !== "wholesale" && (
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {detailInv.pricingTier === "retail" ? t("قطاعي", "Retail") : ""}
                    </span>
                  )}
                  <StatusBadge status={detailInv.status} /></div>
              </div>
              {detailInv.items.map((it, i) => (
                <div key={i} className="rounded-lg border border-border p-3 text-xs space-y-1">
                  <div className="flex justify-between font-semibold"><span>{it.productName}</span><span>{fmtCurrency(it.qtyTons * it.pricePerTon)}</span></div>
                  <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{it.qtyTons} {getBaseUnitLabel(productConfig, language)}</span>
                    {it.bagCount > 0 && <><span className="opacity-40">|</span><span>{fmtNum(it.bagCount)} {getUnitLabel(productConfig, "bag", language)} × {it.bagWeight} {getUnitLabel(productConfig, "kg", language)}</span></>}
                    <span className="opacity-40">|</span><span>{fmtCurrency(it.pricePerTon)}/{getBaseUnitLabel(productConfig, language)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-1 text-sm">
                {detailInv.discountPct > 0 && <div className="flex justify-between text-xs text-destructive"><span>{t("خصم", "Discount")} {detailInv.discountPct}%</span><span>-{fmtCurrency(detailInv.discountAmt)}</span></div>}
                {detailInv.taxPct > 0 && <div className="flex justify-between text-xs text-amber-500"><span>{t("ضريبة", "Tax")} {detailInv.taxPct}%</span><span>+{fmtCurrency(detailInv.taxAmt)}</span></div>}
                <div className="flex justify-between font-bold text-lg"><span>{t("الإجمالي", "Total")}</span><span className="text-primary">{fmtCurrency(detailInv.total)}</span></div>
              </div>
              {/* Payment progress */}
              {(detailInv.paidAmount || 0) > 0 && (
                <div className="rounded-xl bg-muted/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("المدفوع", "Paid")}</span>
                    <span className="font-semibold text-emerald-500">{fmtCurrency(detailInv.paidAmount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, ((detailInv.paidAmount || 0) / detailInv.total) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{fmtNum(Math.round(((detailInv.paidAmount || 0) / detailInv.total) * 100))}%</span>
                    <span>{t("المتبقي", "Remaining")}: {fmtCurrency(detailInv.total - (detailInv.paidAmount || 0))}</span>
                  </div>
                </div>
              )}
              {/* Payment history */}
              {(() => {
                const invPmts = payments.filter(p => p.allocations.some(a => a.invoiceId === detailInv.id));
                if (invPmts.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-muted-foreground">{t("سجل المدفوعات", "Payment History")}</h4>
                    {invPmts.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/10 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-500 font-semibold">{fmtCurrency(p.allocations.find(a => a.invoiceId === detailInv.id)?.amount || 0)}</span>
                          <span className="text-muted-foreground">{fmtDate(p.date)}</span>
                        </div>
                        {p.notes && <span className="text-muted-foreground/60 text-[10px]">{p.notes}</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 gap-2 text-xs" onClick={() => { if (detailInv) handlePrintInvoice(detailInv); }}>
                  <Download className="w-3.5 h-3.5" />{t("طباعة الفاتورة", "Print Invoice")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Customer Dialog ── */}
      <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
        <DialogContent className="sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><UserPlus className="w-4 h-4 text-primary" />{t("إضافة عميل جديد", "New Customer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label>{t("اسم العميل *", "Customer Name *")}</Label>
              <SmartInput field="customer-name" value={newCustName} onChange={setNewCustName} extraSuggestions={customers.map(c => c.name)} placeholder={t("أدخل الاسم", "Enter name")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("رقم الهاتف *", "Phone *")}</Label>
                <Input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="010xxxxxxxx" dir="ltr" className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("رقم هاتف آخر", "Alt. Phone")}</Label>
                <Input value={newCustPhone2} onChange={e => setNewCustPhone2(e.target.value)} placeholder={t("اختياري", "Optional")} dir="ltr" className="h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">{t("العنوان", "Address")}</Label>
              <Input value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} placeholder={t("اختياري", "Optional")} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("المنطقة", "Region")}</Label>
                <Input value={newCustRegion} onChange={e => setNewCustRegion(e.target.value)} placeholder={t("اختياري", "Optional")} className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("المحافظة", "Governorate")}</Label>
                <Input value={newCustGov} onChange={e => setNewCustGov(e.target.value)} placeholder={t("اختياري", "Optional")} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("مركز التوزيع", "Dist. Center")}</Label>
                <Input value={newCustCenter} onChange={e => setNewCustCenter(e.target.value)} placeholder={t("اختياري", "Optional")} className="h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("حد الائتمان (ج.م)", "Credit Limit")}</Label>
                <Input type="number" min="0" value={newCustCredit} onChange={e => setNewCustCredit(e.target.value)} placeholder="0" className="h-9" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleAddCustomer} disabled={!newCustName.trim() || !newCustPhone.trim()}>
                <CheckCircle2 className="w-4 h-4" />{t("إضافة", "Add")}
              </Button>
              <Button variant="outline" onClick={() => setNewCustOpen(false)}>{t("إلغاء", "Cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Sales Report Dialog ── */}
      <Dialog open={reportOpen} onOpenChange={v=>{if(!reportGenerating)setReportOpen(v);}}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary"/>
              {t("تقرير المبيعات","Sales Report")}
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
                  <Label className="text-xs sm:text-sm">{t("العميل","Customer")} ({t("اختياري","Optional")})</Label>
                  <div className="relative">
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder={t("بحث عن عميل...","Search customer...")} className="w-full pr-8 h-8 text-xs rounded-lg" value={reportCustomerSearch} onChange={e=>{setReportCustomerSearch(e.target.value);setReportCustomerId("");}} />
                  </div>
                  {reportCustomerSearch && !reportCustomerId && (
                    <div className="max-h-32 overflow-y-auto space-y-0.5 border border-border/50 rounded-lg p-1">
                      {customers.filter(c=>c.name.includes(reportCustomerSearch)).slice(0,8).map(c=>(
                        <button key={c.id} type="button" onClick={()=>{setReportCustomerId(c.id);setReportCustomerSearch(c.name);}}
                          className="w-full text-right px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors">{c.name}</button>
                      ))}
                      {customers.filter(c=>c.name.includes(reportCustomerSearch)).length===0&&<p className="text-xs text-muted-foreground text-center py-2">{t("لا يوجد عملاء","No customers found")}</p>}
                    </div>
                  )}
                  {reportCustomerId&&<button onClick={()=>{setReportCustomerId("");setReportCustomerSearch("");}} className="text-[10px] text-destructive hover:underline">{t("إلغاء تحديد العميل","Clear customer")}</button>}
                </div>
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs sm:text-sm">{t("الأقسام","Sections")}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {key:"summary",label:t("ملخص المبيعات","Summary"),val:reportSummary,set:setReportSummary},
                      {key:"byCustomer",label:t("مبيعات كل عميل","By Customer"),val:reportByCustomer,set:setReportByCustomer},
                      {key:"listing",label:t("قائمة الفواتير","Invoice List"),val:reportListing,set:setReportListing},
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
                  <Button className="flex-1 gap-2 text-xs sm:text-sm" onClick={handleGenerateSalesReport} disabled={reportDateMode==="range"&&!reportDateFrom&&!reportDateTo}>
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
                  <Button className="gap-2 text-xs sm:text-sm" onClick={handleDownloadSalesPDF}>
                    <Download className="w-3.5 h-3.5"/>{t("تحميل PDF","Download PDF")}
                  </Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={()=>{setReportOpen(false);setReportGenerated(false);}}>{t("إغلاق","Close")}</Button>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
