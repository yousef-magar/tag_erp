import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { logActivity } from "@/hooks/use-activity-log";
import { useSalesStore, type Customer, type SalesInvoice } from "@/hooks/use-sales-store";
import { useHRStore } from "@/hooks/use-hr-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, Plus, ArrowRightLeft, CreditCard, Banknote, CheckCircle2, TrendingUp, TrendingDown, Search, User, Phone, Hash, Receipt, Calendar, HandCoins, Settings, Pencil, Trash2, X, Smartphone, AlertTriangle, BarChart3, Download } from "lucide-react";
import SmartInput from "@/components/SmartInput";

const fmtNum = (n: number) => n.toLocaleString("ar-EG");
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("T")[0].split("-"); if (p.length !== 3) return d; return `${p[2]}/${p[1]}/${p[0]}`; };
const invRemaining = (inv: SalesInvoice) => Math.max(0, inv.total - (inv.paidAmount || 0));

const arabicOnes = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const arabicTens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const arabicHundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function threeDigitsAr(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100), r = n % 100;
  let s = arabicHundreds[h];
  if (r > 0) {
    if (s) s += " ";
    if (r < 20) s += arabicOnes[r];
    else {
      const u = r % 10, t = Math.floor(r / 10);
      if (u > 0) s += arabicOnes[u] + " و " + arabicTens[t];
      else s += arabicTens[t];
    }
  }
  return s;
}

function numberToArabicWords(n: number): string {
  if (n === 0) return "صفر";
  const groups: [number, string, string, string][] = [
    [1e9, "مليار", "ملياران", "مليارات"],
    [1e6, "مليون", "مليونان", "ملايين"],
    [1e3, "ألف", "ألفان", "آلاف"],
  ];
  let parts: string[] = [];
  let remaining = Math.floor(n);
  for (const [div, single, dual, plural] of groups) {
    if (remaining >= div) {
      const q = Math.floor(remaining / div);
      remaining %= div;
      if (q === 1) parts.push(single);
      else if (q === 2) parts.push(dual);
      else {
        const words = threeDigitsAr(q);
        parts.push(words + " " + ((q >= 3 && q <= 10) ? plural : single));
      }
    }
  }
  if (remaining > 0) parts.push(threeDigitsAr(remaining));
  return parts.join(" و ");
}

function numberToEnglishWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function threeEn(n: number): string {
    if (n === 0) return "";
    const h = Math.floor(n / 100), r = n % 100;
    let s = "";
    if (h > 0) s += ones[h] + " Hundred ";
    if (r > 0) {
      if (h > 0) s += "and ";
      if (r < 20) s += ones[r];
      else { const u = r % 10; s += tens[Math.floor(r / 10)]; if (u > 0) s += " " + ones[u]; }
    }
    return s.trim();
  }
  const groups: [number, string][] = [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"]];
  let result = "", remaining = Math.floor(n);
  for (const [div, name] of groups) {
    if (remaining >= div) {
      const q = Math.floor(remaining / div);
      remaining %= div;
      result += threeEn(q) + " " + name + " ";
    }
  }
  if (remaining > 0) result += threeEn(remaining) + " ";
  else if (result === "") result = "Zero ";
  return result.trim() + " EGP";
}

export default function Accounting() {
  const { t, language, bankAccounts, walletAccounts, addBankAccount, updateBankAccount, deleteBankAccount, addWalletAccount, updateWalletAccount, deleteWalletAccount, updateBankBalance, updateWalletBalance, paymentMethods, expenseCategories, addExpenseCategory, deleteExpenseCategory } = useAppStore();
  const store = useSalesStore();
  const { exportedPayrollEntries } = useHRStore();
  const customers = store.customers;
  const invoices = store.invoices;
  const payments = store.payments;
  const addPayment = store.addPayment;

  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [mgmtTab, setMgmtTab] = useState<"banks" | "wallets" | "categories">("banks");
  // Add bank form
  const [newBankName, setNewBankName] = useState("");
  // Add wallet form
  const [newWalName, setNewWalName] = useState("");
  const [newWalType, setNewWalType] = useState<"vodafone_cash" | "instapay">("vodafone_cash");
  const [newWalIdent, setNewWalIdent] = useState("");
  const [newWalMaxLimit, setNewWalMaxLimit] = useState("");
  // Edit state
  const [editBankId, setEditBankId] = useState<string | null>(null);
  const [editBankName, setEditBankName] = useState("");
  const [editWalId, setEditWalId] = useState<string | null>(null);
  const [editWalName, setEditWalName] = useState("");
  const [editWalType, setEditWalType] = useState<"vodafone_cash" | "instapay">("vodafone_cash");
  const [editWalIdent, setEditWalIdent] = useState("");
  const [editWalMaxLimit, setEditWalMaxLimit] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [showNewOutCat, setShowNewOutCat] = useState(false);
  const [newOutCatName, setNewOutCatName] = useState("");
  const [cashInDone, setCashInDone] = useState(false);
  const [cashOutDone, setCashOutDone] = useState(false);

  const [treasuryBal, setTreasuryBal] = useState<number>(() => {
    try { return Number(JSON.parse(localStorage.getItem("feedflow-treasury") || "0")); } catch { return 0; }
  });
  useEffect(() => { localStorage.setItem("feedflow-treasury", String(treasuryBal)); }, [treasuryBal]);

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repTrial, setRepTrial] = useState(true);
  const [repIncome, setRepIncome] = useState(true);
  const [repBalance, setRepBalance] = useState(true);

  // Banks loaded from localStorage (empty after reset)

  const allAccounts = useMemo(() => [
    { id: "treasury", type: "treasury" as const, balance: Number(treasuryBal) },
    ...bankAccounts.map(b => ({ id: b.id, type: "bank" as const, balance: Number(b.balance) })),
    ...walletAccounts.map(w => ({ id: w.id, type: w.type as "vodafone_cash" | "instapay", balance: Number(w.balance) })),
  ], [treasuryBal, bankAccounts, walletAccounts]);
  const totalBalance = useMemo(() => allAccounts.reduce((s, a) => s + a.balance, 0), [allAccounts]);

  const accountMeta: Record<string, { name: [string, string]; icon: any; color: string }> = {
    treasury: { name: ["الخزينة الرئيسية", "Main Treasury"], icon: Banknote, color: "text-primary" },
  };
  const bankIconMap: Record<string, { icon: any; color: string }> = {
    nbe: { icon: CreditCard, color: "text-blue-500" },
    cib: { icon: CreditCard, color: "text-purple-500" },
    qnb: { icon: CreditCard, color: "text-amber-500" },
  };
  const accountName = (id: string) => {
    if (id === "treasury") return t("الخزينة الرئيسية", "Main Treasury");
    const bank = bankAccounts.find(b => b.id === id);
    if (bank) return bank.name;
    const wallet = walletAccounts.find(w => w.id === id);
    return wallet ? `${wallet.name} (${wallet.identifier})` : id;
  };
  const accountColor = (id: string) => {
    if (id === "treasury") return "text-primary";
    if (bankIconMap[id]) return bankIconMap[id].color;
    if (walletAccounts.find(w => w.id === id)) return "text-emerald-500";
    return "text-blue-500";
  };
  const accountIcon = (id: string) => {
    if (id === "treasury") return Banknote;
    if (bankIconMap[id]) return bankIconMap[id].icon;
    if (walletAccounts.find(w => w.id === id)) return CreditCard;
    return CreditCard;
  };

  const [inAmount, setInAmount] = useState("");
  const [inSource, setInSource] = useState("");
  const [inMethod, setInMethod] = useState<"cash" | "bank_transfer" | "vodafone_cash" | "instapay">("cash");
  const [inBank, setInBank] = useState("");
  const [inNote, setInNote] = useState("");

  const [custQ, setCustQ] = useState("");
  const [selCust, setSelCust] = useState<Customer | null>(null);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [allocMap, setAllocMap] = useState<Record<string, number>>({});

  const [outAmount, setOutAmount] = useState("");
  const [outCategory, setOutCategory] = useState("");
  const [outMethod, setOutMethod] = useState<"cash" | "bank_transfer" | "vodafone_cash" | "instapay">("cash");
  const [outBank, setOutBank] = useState("");
  const [outNote, setOutNote] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "in" | "out">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [ledger, setLedger] = useState<{ id: number; type: "in" | "out"; label: string; amount: number; time: string; date: string }[]>([]);

  const filteredLedger = useMemo(() => {
    let items = ledger;
    if (ledgerFilter !== "all") {
      items = items.filter(e => e.type === ledgerFilter);
    }
    const today = new Date().toISOString().split("T")[0];
    if (dateFilter === "today") {
      items = items.filter(e => e.date === today);
    } else if (dateFilter === "custom" && dateFrom) {
      const from = dateFrom;
      const to = dateTo || dateFrom;
      items = items.filter(e => e.date >= from && e.date <= to);
    }
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.trim().toLowerCase();
      items = items.filter(e => e.label.toLowerCase().includes(q));
    }
    return items;
  }, [ledger, ledgerFilter, dateFilter, dateFrom, dateTo, ledgerSearch]);

  const isCustomerSource = inSource === t("تحصيل من عميل", "Customer collection") || inSource === "Customer collection";

  const custFiltered = useMemo(() => {
    if (!custQ.trim() || !customers) return [];
    const q = custQ.trim().toLowerCase();
    return customers.filter((c: Customer) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }, [custQ, customers]);

  const outstandingInvs = useMemo(() => {
    if (!selCust || !invoices) return [];
    return invoices
      .filter((i: SalesInvoice) => i.customerId === selCust.id && i.status !== "paid" && invRemaining(i) > 0)
      .sort((a: SalesInvoice, b: SalesInvoice) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selCust, invoices]);

  const totalRemaining = useMemo(() =>
    outstandingInvs.reduce((s: number, i: SalesInvoice) => s + invRemaining(i), 0),
    [outstandingInvs],
  );

  const totalAllocated = useMemo(() =>
    Object.values(allocMap).reduce((s, v) => s + (v || 0), 0),
    [allocMap],
  );

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(num));

  const resetCustomerState = () => {
    setCustQ("");
    setSelCust(null);
    setShowCustDropdown(false);
    setAllocMap({});
  };

  const handleOpenCashIn = () => {
    setCashInOpen(true);
    setCashInDone(false);
    resetCustomerState();
    setInMethod("cash");
    setInBank("");
    setInSource(t("تحصيل من عميل", "Customer collection"));
  };

  const handleAutoAlloc = () => {
    const amt = parseFloat(inAmount) || 0;
    if (amt <= 0 || outstandingInvs.length === 0) return;
    const map: Record<string, number> = {};
    let rem = amt;
    for (const inv of outstandingInvs) {
      if (rem <= 0) break;
      const left = invRemaining(inv);
      const alloc = Math.min(rem, left);
      if (alloc > 0) map[inv.id] = alloc;
      rem -= alloc;
    }
    setAllocMap(map);
  };

  const handleManualAlloc = (invId: string, val: string) => {
    const num = parseFloat(val) || 0;
    const inv = outstandingInvs.find((i: SalesInvoice) => i.id === invId);
    if (!inv) return;
    const maxAlloc = invRemaining(inv);
    const clamped = Math.min(num, maxAlloc);
    setAllocMap((prev: Record<string, number>) => {
      const next = { ...prev };
      if (clamped <= 0) delete next[invId];
      else next[invId] = clamped;
      return next;
    });
  };

  const handleCashIn = () => {
    if (!inAmount || !inSource) return;
    const amount = parseFloat(inAmount);

    if (isCustomerSource && selCust && totalAllocated > 0) {
      addPayment({
        id: `PAY-${Date.now()}`,
        customerId: selCust.id,
        customerName: selCust.name,
        date: new Date().toISOString().split("T")[0],
        amount: totalAllocated,
        type: "cash_receipt",
        allocations: Object.entries(allocMap).map(([invoiceId, a]) => ({ invoiceId, amount: a })),
        notes: inNote || undefined,
      });
    }

    const label = isCustomerSource && selCust
      ? `${t("تحصيل من", "Collection from")} ${selCust.name}`
      : inSource + (inNote ? ` — ${inNote}` : "");

    if (inMethod === "bank_transfer") {
      updateBankBalance(inBank, amount);
    } else if (inMethod === "vodafone_cash" || inMethod === "instapay") {
      updateWalletBalance(inBank, amount);
    } else {
      setTreasuryBal(prev => prev + amount);
    }
    setLedger((prev: typeof ledger) => [{ id: Date.now(), type: "in" as const, label, amount, date: new Date().toISOString().split("T")[0], time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) }, ...prev]);
    logActivity("accounting", "create", `قبض نقدية: ${amount} جنيه - ${label}`, `Cash in: ${amount} EGP - ${label}`);
    setCashInDone(true);
    setTimeout(() => {
      setCashInDone(false);
      setCashInOpen(false);
      setInAmount("");
      setInSource("");
      setInMethod("cash");
      setInBank("");
      setInNote("");
      resetCustomerState();
    }, 1400);
  };

  const handleCashOut = () => {
    if (!outAmount || !outCategory) return;
    const amount = parseFloat(outAmount);
    if (outMethod === "bank_transfer") {
      if (!outBank) return;
      updateBankBalance(outBank, -amount);
    } else if (outMethod === "vodafone_cash" || outMethod === "instapay") {
      if (!outBank) return;
      updateWalletBalance(outBank, -amount);
    } else {
      setTreasuryBal(prev => prev - amount);
    }
    setLedger((prev: typeof ledger) => [{ id: Date.now(), type: "out" as const, label: outCategory + (outNote ? ` — ${outNote}` : ""), amount, date: new Date().toISOString().split("T")[0], time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) }, ...prev]);
    logActivity("accounting", "create", `صرف نقدية: ${amount} جنيه - ${outCategory}${outNote ? ` (${outNote})` : ""}`, `Cash out: ${amount} EGP - ${outCategory}${outNote ? ` (${outNote})` : ""}`);
    setCashOutDone(true);
    setTimeout(() => { setCashOutDone(false); setCashOutOpen(false); setOutAmount(""); setOutCategory(""); setOutMethod("cash"); setOutBank(""); setOutNote(""); }, 1400);
  };

  // ── Accounting Report ──
  const handleGenerateReport = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };
  const handleDownloadPDF = () => {
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodLabel = repDateMode === "all" ? t("كل الفترة", "All Period") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;
    
    // Financial data calculations
    const totalInvoices = invoices.length;
    const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const totalPending = totalRevenue - totalPaid;
    
    // Filter by date
    const filteredInvoices = invoices.filter(inv => {
      if (repDateMode === "today" && inv.date !== new Date().toISOString().split("T")[0]) return false;
      if (repDateMode === "range") {
        if (repDateFrom && inv.date < repDateFrom) return false;
        if (repDateTo && inv.date > repDateTo) return false;
      }
      return true;
    });
    const filtRevenue = filteredInvoices.reduce((s, i) => s + i.total, 0);
    const filtPaid = filteredInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const filtPending = filtRevenue - filtPaid;
    
    const totalExpenses = (exportedPayrollEntries || []).reduce((s, e) => s + (e.totalAmount || 0), 0);
    const bankBalance = (bankAccounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);
    const walletBalance = (walletAccounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);
    
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
      .badge-green{background:#dcfce7;color:#15803d}.badge-red{background:#fee2e2;color:#dc2626}.badge-amber{background:#fef3c7;color:#b45309}
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
    `;
    
    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right"><h1>${t("تقرير الحسابات", "Accounting Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>📊 ${t("تقرير مالي", "Financial Report")}</span><span>💰 ${formatCurrency(filtRevenue)}</span></div>
      ${repTrial ? `
      <div class="section"><h2>${t("ميزان المراجعة", "Trial Balance")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${formatCurrency(filtRevenue)}</div><div class="lbl">${t("إجمالي الإيرادات", "Total Revenue")}</div></div>
          <div class="card"><div class="num num-green">${formatCurrency(filtPaid)}</div><div class="lbl">${t("إجمالي المدفوعات", "Total Paid")}</div></div>
          <div class="card"><div class="num num-amber">${formatCurrency(filtPending)}</div><div class="lbl">${t("المستحق", "Pending")}</div></div>
          <div class="card"><div class="num num-red">${formatCurrency(totalExpenses)}</div><div class="lbl">${t("المصروفات", "Expenses")}</div></div>
        </div>
        <table><tr><th>${t("البيان", "Account")}</th><th>${t("المديون", "Debit")}</th><th>${t("الدائن", "Credit")}</th></tr>
        <tr><td>${t("الإيرادات", "Revenue")}</td><td>—</td><td style="font-weight:600;color:#15803d">${formatCurrency(filtRevenue)}</td></tr>
        <tr><td>${t("المدفوعات", "Payments")}</td><td style="font-weight:600;color:#15803d">${formatCurrency(filtPaid)}</td><td>—</td></tr>
        <tr><td>${t("المستحقات", "Receivables")}</td><td style="font-weight:600;color:#dc2626">${formatCurrency(filtPending)}</td><td>—</td></tr>
        <tr><td>${t("المصروفات", "Expenses")}</td><td style="font-weight:600;color:#dc2626">${formatCurrency(totalExpenses)}</td><td>—</td></tr>
        <tr style="background:#eef2ff"><td><strong>${t("المجموع", "Total")}</strong></td><td><strong>${formatCurrency(filtPaid + filtPending + totalExpenses)}</strong></td><td><strong>${formatCurrency(filtRevenue)}</strong></td></tr>
        </table>
      </div>` : ""}
      ${repIncome ? `
      <div class="section"><h2>${t("قائمة الدخل", "Income Statement")}</h2>
        <table>
          <tr><th>${t("البيان", "Item")}</th><th>${t("المبلغ", "Amount")}</th></tr>
          <tr><td><strong>${t("الإيرادات", "Revenue")}</strong></td><td style="font-weight:600;color:#15803d">${formatCurrency(filtRevenue)}</td></tr>
          <tr><td>${t("مصروفات الرواتب", "Salary Expenses")}</td><td style="color:#dc2626">-${formatCurrency(totalExpenses)}</td></tr>
          <tr style="background:#eef2ff"><td><strong>${t("صافي الربح", "Net Profit")}</strong></td><td style="font-weight:800;color:#1d4ed8;font-size:13px">${formatCurrency(filtRevenue - totalExpenses)}</td></tr>
        </table>
      </div>` : ""}
      ${repBalance ? `
      <div class="section"><h2>${t("قائمة المركز المالي", "Balance Sheet")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${formatCurrency(bankBalance)}</div><div class="lbl">${t("البنوك", "Banks")}</div></div>
          <div class="card"><div class="num num-green">${formatCurrency(walletBalance)}</div><div class="lbl">${t("المحافظ", "Wallets")}</div></div>
          <div class="card"><div class="num num-amber">${formatCurrency(filtPending)}</div><div class="lbl">${t("ذمم مدينة", "Receivables")}</div></div>
          <div class="card"><div class="num num-blue">${formatCurrency(bankBalance + walletBalance + filtPending)}</div><div class="lbl">${t("إجمالي الأصول", "Total Assets")}</div></div>
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

  const canConfirm = isCustomerSource
    ? (!!inAmount && !!inSource && !!selCust && totalAllocated > 0)
    : (!!inAmount && !!inSource && (inMethod === "cash" || !!inBank));

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("الحسابات والمالية", "Accounting")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("إدارة الخزينة والبنوك والقيود", "Treasury, banking and ledger management")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 w-full sm:w-auto" onClick={() => { setCashOutOpen(true); setCashOutDone(false); }}>
            <ArrowRightLeft className="w-4 h-4" />
            {t("صرف نقدية", "Cash Out")}
          </Button>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto" onClick={handleOpenCashIn}>
            <Plus className="w-4 h-4" />
            {t("قبض نقدية", "Cash In")}
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setRepOpen(true)}>
            <BarChart3 className="w-4 h-4" />{t("تقرير", "Report")}
          </Button>
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => setMgmtOpen(true)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {allAccounts.map(acc => {
          const Icon = accountIcon(acc.id);
          return (
            <Card key={acc.id} className="p-3 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 ${accountColor(acc.id)}/10 ${accountColor(acc.id)} rounded-lg`}><Icon className="w-6 h-6" /></div>
                <h3 className="font-bold text-lg">{accountName(acc.id)}</h3>
              </div>
              <motion.p key={acc.balance} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`text-2xl sm:text-3xl font-bold tracking-tight ${accountColor(acc.id)}`}>{formatCurrency(acc.balance)}</motion.p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">{t("رصيد حالي", "Current Balance")}</p>
            </Card>
          );
        })}
        <Card className="p-3 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg"><Calculator className="w-6 h-6" /></div>
            <h3 className="font-bold text-lg">{t("إجمالي الأصول", "Total Assets")}</h3>
          </div>
          <motion.p key={totalBalance} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-500">{formatCurrency(totalBalance)}</motion.p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">{t("خزينة + بنوك", "Treasury + Banks")}</p>
        </Card>
      </motion.div>

      {/* Daily Ledger */}
      <Card className="p-3 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm sm:text-lg">{t("يومية الخزينة", "Daily Cash Ledger")}</h3>
          <span className="text-xs text-muted-foreground">{filteredLedger.length} {t("حركة", "entries")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
            <Input value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)}
              className="h-10 pr-10 text-sm rounded-xl" placeholder={t("ابحث في الحركات...", "Search entries...")} />
          </div>
          <div className="flex gap-1 rounded-lg bg-muted/40 p-0.5 border border-border/30">
            {(["all", "in", "out"] as const).map(f => (
              <button key={f} onClick={() => setLedgerFilter(f)}
                className={`px-3 h-8 rounded-md text-[11px] font-medium transition-all ${ledgerFilter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? t("الكل", "All") : f === "in" ? t("قبض", "In") : t("صرف", "Out")}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-1 rounded-lg bg-muted/40 p-0.5 border border-border/30">
            {(["all", "today", "custom"] as const).map(f => (
              <button key={f} onClick={() => { setDateFilter(f); if (f !== "custom") { setDateFrom(""); setDateTo(""); } }}
                className={`px-3 h-8 rounded-md text-[11px] font-medium transition-all ${dateFilter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? t("الكل", "All") : f === "today" ? t("اليوم", "Today") : t("مخصص", "Custom")}
              </button>
            ))}
          </div>
          {dateFilter === "custom" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-full sm:w-36 text-xs rounded-lg" />
              <span className="text-[10px] text-muted-foreground">—</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-full sm:w-36 text-xs rounded-lg" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <AnimatePresence>
            {filteredLedger.length === 0 ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground text-center py-8">
                {t("لا توجد حركات تطابق البحث", "No matching entries")}
              </motion.p>
            ) : (
              filteredLedger.map((entry) => (
                <motion.div key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} layout className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${entry.type === "in" ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                      {entry.type === "in" ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{fmtDate(entry.date)}</span>
                        <span className="opacity-40">|</span>
                        <span>{entry.time}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold ${entry.type === "in" ? "text-emerald-500" : "text-destructive"}`}>
                    {entry.type === "in" ? "+" : "-"}{formatCurrency(entry.amount)}
                  </span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Payroll Expenses */}
      {exportedPayrollEntries.length > 0 && (
        <Card className="p-3 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm sm:text-lg">{t("مصروفات الرواتب", "Payroll Expenses")}</h3>
            <span className="text-xs text-muted-foreground">{exportedPayrollEntries.length} {t("شهر", "months")}</span>
          </div>
          <div className="space-y-2">
            {[...exportedPayrollEntries].reverse().map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-500/10"><Banknote className="w-4 h-4 text-purple-500" /></div>
                  <div>
                    <p className="text-sm font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(e.date)}</p>
                  </div>
                </div>
                <span className="font-bold text-destructive">-{formatCurrency(e.totalAmount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cash In Dialog */}
      <Dialog open={cashInOpen} onOpenChange={v => { setCashInOpen(v); if (!v) resetCustomerState(); }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-lg max-h-[90vh] overflow-y-auto !p-0">
          <div className="bg-gradient-to-b from-emerald-500/[0.07] to-transparent px-6 pt-6 pb-4 rounded-t-2xl border-b border-border/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500"><Banknote className="w-5 h-5"/>{t("قبض نقدية", "Cash In")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 space-y-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("المبلغ (ج.م)", "Amount (EGP)")}</Label>
              <Input type="number" min="0" placeholder="0" value={inAmount}
                onChange={e => { setInAmount(e.target.value); }}
                className="h-11 text-lg font-bold text-center rounded-xl" />
              {(() => {
                const amt = parseFloat(inAmount);
                if (!amt || amt <= 0) return null;
                const words = language === "ar" ? numberToArabicWords(amt) : numberToEnglishWords(amt);
                return (
                  <p className="text-[10px] text-muted-foreground text-center leading-relaxed border border-border/30 rounded-lg px-3 py-1.5 bg-muted/20">
                    <span className="text-[9px] opacity-50">{language === "ar" ? "مبلغ وقدره" : "Amount in words"}: </span>
                    {words}
                  </p>
                );
              })()}
            </div>

            {/* Source */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("المصدر", "Source")}</Label>
              <Select value={inSource} onValueChange={v => { setInSource(v); if (v !== t("تحصيل من عميل", "Customer collection") && v !== "Customer collection") resetCustomerState(); }}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={t("اختر المصدر", "Select source")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={t("تحصيل من عميل", "Customer collection")}><span className="flex items-center gap-2"><User className="w-3.5 h-3.5"/>{t("تحصيل من عميل", "Customer Collection")}</span></SelectItem>
                  <SelectItem value={t("مبيعات نقدية", "Cash sales")}>{t("مبيعات نقدية", "Cash Sales")}</SelectItem>
                  <SelectItem value={t("إيراد متنوع", "Misc revenue")}>{t("إيراد متنوع", "Miscellaneous")}</SelectItem>
                  <SelectItem value={t("سحب بنكي", "Bank withdrawal")}>{t("سحب بنكي", "Bank Withdrawal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("طريقة الدفع", "Payment Method")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setInMethod("cash"); setInBank(""); }}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${inMethod === "cash" ? "border-emerald-500 bg-emerald-500/5 text-emerald-600 shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                  <Banknote className="w-4 h-4" />{t("نقدي", "Cash")}
                </button>
                <button type="button" onClick={() => setInMethod("bank_transfer")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${inMethod === "bank_transfer" ? "border-blue-500 bg-blue-500/5 text-blue-600 shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                  <CreditCard className="w-4 h-4" />{t("تحويل بنكي", "Bank Transfer")}
                </button>
                <button type="button" onClick={() => setInMethod("vodafone_cash")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${inMethod === "vodafone_cash" ? "border-orange-500 bg-orange-500/5 text-orange-600 shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                  <CreditCard className="w-4 h-4" />{t("فودافون كاش", "Vodafone Cash")}
                </button>
                <button type="button" onClick={() => setInMethod("instapay")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${inMethod === "instapay" ? "border-purple-500 bg-purple-500/5 text-purple-600 shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                  <CreditCard className="w-4 h-4" />{t("انستا باي", "InstaPay")}
                </button>
              </div>
            </div>

            {/* Target account selector (bank/wallet) */}
            {inMethod !== "cash" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {inMethod === "bank_transfer" ? t("البنك", "Bank")
                    : inMethod === "vodafone_cash" ? t("رقم محفظة فودافون", "Vodafone Wallet")
                    : t("رقم حساب انستا باي", "InstaPay Account")}
                </Label>
                <Select value={inBank} onValueChange={setInBank}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={t("اختر", "Select")} /></SelectTrigger>
                  <SelectContent>
                    {inMethod === "bank_transfer" && bankAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}><span className="flex items-center gap-2">{acc.name} ({fmtNum(acc.balance)} ج.م)</span></SelectItem>
                    ))}
                    {(inMethod === "vodafone_cash" || inMethod === "instapay") && walletAccounts.filter(w => w.type === inMethod).map(w => (
                      <SelectItem key={w.id} value={w.id}><span className="flex items-center gap-2">{w.name} — {w.identifier} ({fmtNum(w.balance)} ج.م)</span></SelectItem>
                    ))}
                    {(inMethod === "vodafone_cash" || inMethod === "instapay") && walletAccounts.filter(w => w.type === inMethod).length === 0 && (
                      <SelectItem value="__none__" disabled>{t("لا توجد محافظ مسجلة", "No wallets registered")}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {(inMethod === "vodafone_cash" || inMethod === "instapay") && inBank && (() => {
                  const wal = walletAccounts.find(w => w.id === inBank);
                  const amt = parseFloat(inAmount) || 0;
                  if (!wal || !wal.maxLimit || amt <= 0) return null;
                  const newBal = wal.balance + amt;
                  if (newBal > wal.maxLimit) {
                    return (
                      <p className="flex items-center gap-1 text-[10px] text-destructive mt-1.5">
                        <AlertTriangle className="w-3 h-3"/>{t("الرصيد سيتجاوز الحد الأقصى", "Balance will exceed max limit")} ({fmtNum(wal.maxLimit)} ج.م)
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            {/* Customer section */}
            {isCustomerSource && (
              <div className="space-y-3 rounded-xl border border-border/40 bg-muted/5 p-4">
                <div className="relative">
                  <Label className="text-xs font-semibold mb-1.5 block">{t("اختيار العميل", "Select Customer")}</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                    <Input className="h-10 pr-10 text-sm rounded-xl"
                      placeholder={t("ابحث بالاسم أو الهاتف...", "Search by name or phone...")}
                      value={custQ}
                      onChange={e => { setCustQ(e.target.value); setShowCustDropdown(true); if (!e.target.value) setSelCust(null); }}
                      onFocus={() => setShowCustDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)}
                    />
                  </div>
                  {showCustDropdown && custFiltered.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 w-[calc(100%-2rem)] rounded-xl border bg-popover shadow-lg overflow-hidden">
                      <ScrollArea className="max-h-40">
                        {custFiltered.map(c => (
                          <button key={c.id} type="button" onMouseDown={() => { setSelCust(c); setShowCustDropdown(false); setCustQ(c.name); setAllocMap({}); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-right hover:bg-accent/70 transition-colors border-b border-border/20 last:border-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {c.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground">{c.phone} · {c.code}</p>
                            </div>
                            <span className={`text-[10px] font-semibold ${c.outstandingDebt > 0 ? "text-destructive" : "text-emerald-500"}`}>
                              {fmtNum(c.outstandingDebt)} ج.م
                            </span>
                          </button>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                </div>

                {/* Selected customer info + invoices */}
                {selCust && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary/[0.04] to-transparent border border-border/50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                          {selCust.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{selCust.name}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                            <Phone className="w-3 h-3"/>{selCust.phone} <Hash className="w-3 h-3"/>{selCust.code}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] text-muted-foreground">{t("المتبقي", "Remaining")}</p>
                        <p className="font-bold text-destructive text-sm">{fmtNum(totalRemaining)} <span className="text-[9px] text-muted-foreground">ج.م</span></p>
                      </div>
                    </div>

                    {outstandingInvs.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {t("الفواتير المستحقة", "Outstanding Invoices")} ({outstandingInvs.length})
                          </span>
                          <button type="button" onClick={handleAutoAlloc} disabled={!parseFloat(inAmount) || parseFloat(inAmount) <= 0}
                            className="text-[10px] font-medium text-primary hover:underline disabled:opacity-30 flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3"/>{t("توزيع تلقائي", "Auto")}
                          </button>
                        </div>
                        {outstandingInvs.map((inv: SalesInvoice) => (
                          <div key={inv.id} className="rounded-xl border border-border/40 bg-card p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Receipt className="w-3 h-3 text-muted-foreground/40 shrink-0"/>
                                <span className="text-xs font-semibold">{inv.id}</span>
                                <span className="text-[9px] px-1 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{fmtDate(inv.date)}</span>
                              </div>
                              <span className="text-xs font-bold">{fmtNum(inv.total)} <span className="text-[9px] text-muted-foreground font-normal">ج.م</span></span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${Math.min(100, ((inv.paidAmount || 0) / inv.total) * 100)}%` }} />
                              </div>
                              <span className="text-[9px] text-muted-foreground/60">{t("باقي", "Due")} <strong className="text-destructive">{fmtNum(invRemaining(inv))}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground/50">{t("تخصيص", "Alloc")}:</span>
                              <Input type="number" min="0" step="0.01"
                                className="h-7 flex-1 text-xs text-center rounded-lg border-border/50"
                                placeholder="0" value={allocMap[inv.id] ?? ""}
                                onChange={e => handleManualAlloc(inv.id, e.target.value)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-6 text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500/40" />
                        <p className="text-xs">{t("لا توجد فواتير مستحقة لهذا العميل", "Customer has no outstanding invoices")}</p>
                      </div>
                    )}

                    {totalAllocated > 0 && (
                      <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500"/>
                          <span className="text-xs font-medium text-emerald-600">{t("سيتم توزيع", "Will allocate")}</span>
                        </div>
                        <span className="font-bold text-emerald-600">{fmtNum(totalAllocated)} ج.م</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("ملاحظة", "Note")} <span className="text-muted-foreground/50">{t("(اختياري)", "(optional)")}</span></Label>
              <Input placeholder={t("ملاحظة...", "Note...")} value={inNote} onChange={e => setInNote(e.target.value)} className="h-9 text-sm rounded-xl" />
            </div>

            {/* Submit */}
            <AnimatePresence mode="wait">
              {cashInDone ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-bold">{t("تم القبض!", "Cash received!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex gap-3 pt-1">
                  <Button className="flex-1 h-11 rounded-xl text-sm font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={handleCashIn} disabled={!canConfirm}>
                    <Banknote className="w-4 h-4"/>{t("تأكيد القبض", "Confirm Receipt")}
                  </Button>
                  <Button variant="outline" className="h-11 rounded-xl px-6" onClick={() => setCashInOpen(false)}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Out Dialog */}
      <Dialog open={cashOutOpen} onOpenChange={v => { setCashOutOpen(v); if (!v) { setOutMethod("cash"); setOutBank(""); } }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
          <div className="bg-gradient-to-b from-destructive/[0.06] to-transparent px-6 pt-6 pb-4 rounded-t-2xl border-b border-border/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><ArrowRightLeft className="w-5 h-5"/>{t("صرف نقدية", "Cash Out")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 space-y-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("المبلغ (ج.م)", "Amount (EGP)")}</Label>
              <Input type="number" min="0" placeholder="0" value={outAmount} onChange={e => setOutAmount(e.target.value)} className="h-11 text-lg font-bold text-center rounded-xl" />
              {(() => {
                const amt = parseFloat(outAmount);
                if (!amt || amt <= 0) return null;
                const words = language === "ar" ? numberToArabicWords(amt) : numberToEnglishWords(amt);
                return (
                  <p className="text-[10px] text-muted-foreground text-center leading-relaxed border border-border/30 rounded-lg px-3 py-1.5 bg-muted/20">
                    <span className="text-[9px] opacity-50">{language === "ar" ? "مبلغ وقدره" : "Amount in words"}: </span>
                    {words}
                  </p>
                );
              })()}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("بند الصرف", "Expense Category")}</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={outCategory} onValueChange={setOutCategory}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={t("اختر البند", "Select category")} /></SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button type="button" onClick={() => { setShowNewOutCat(true); setOutCategory(""); }}
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-all"
                  title={t("إضافة بند جديد", "Add new category")}>
                  <Plus className="w-4 h-4"/>
                </button>
              </div>
              {showNewOutCat && (
                <div className="flex items-center gap-2">
                  <SmartInput value={newOutCatName} onChange={setNewOutCatName}
                    className="h-9 text-sm rounded-lg flex-1" placeholder={t("اسم البند الجديد", "New category name")} extraSuggestions={expenseCategories} autoFocus />
                  <Button type="button" size="sm" className="h-9 rounded-lg shrink-0" disabled={!newOutCatName.trim()}
                    onClick={() => {
                      if (!newOutCatName.trim()) return;
                      addExpenseCategory(newOutCatName.trim());
                      setOutCategory(newOutCatName.trim());
                      setNewOutCatName("");
                      setShowNewOutCat(false);
                    }}>
                    {t("إضافة", "Add")}
                  </Button>
                  <button type="button" onClick={() => { setShowNewOutCat(false); setNewOutCatName(""); }}
                    className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("طريقة الدفع", "Payment Method")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setOutMethod("cash"); setOutBank(""); }}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${outMethod === "cash" ? "border-destructive bg-destructive/5 text-destructive shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                  <Banknote className="w-4 h-4" />{t("نقدي", "Cash")}
                </button>
                <button type="button" onClick={() => setOutMethod("bank_transfer")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${outMethod === "bank_transfer" ? "border-blue-500 bg-blue-500/5 text-blue-600 shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                  <CreditCard className="w-4 h-4" />{t("تحويل بنكي", "Bank Transfer")}
                </button>
                <button type="button" onClick={() => setOutMethod("vodafone_cash")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${outMethod === "vodafone_cash" ? "border-orange-500 bg-orange-500/5 text-orange-600 shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                  <CreditCard className="w-4 h-4" />{t("فودافون كاش", "Vodafone Cash")}
                </button>
                <button type="button" onClick={() => setOutMethod("instapay")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${outMethod === "instapay" ? "border-purple-500 bg-purple-500/5 text-purple-600 shadow-sm" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                  <CreditCard className="w-4 h-4" />{t("انستا باي", "InstaPay")}
                </button>
              </div>
            </div>

            {/* Target account selector */}
            {outMethod !== "cash" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {outMethod === "bank_transfer" ? t("البنك", "Bank")
                    : outMethod === "vodafone_cash" ? t("رقم محفظة فودافون", "Vodafone Wallet")
                    : t("رقم حساب انستا باي", "InstaPay Account")}
                </Label>
                <Select value={outBank} onValueChange={setOutBank}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={t("اختر", "Select")} /></SelectTrigger>
                  <SelectContent>
                    {outMethod === "bank_transfer" && bankAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}><span className="flex items-center gap-2">{acc.name} ({fmtNum(acc.balance)} ج.م)</span></SelectItem>
                    ))}
                    {(outMethod === "vodafone_cash" || outMethod === "instapay") && walletAccounts.filter(w => w.type === outMethod).map(w => (
                      <SelectItem key={w.id} value={w.id}><span className="flex items-center gap-2">{w.name} — {w.identifier} ({fmtNum(w.balance)} ج.م)</span></SelectItem>
                    ))}
                    {(outMethod === "vodafone_cash" || outMethod === "instapay") && walletAccounts.filter(w => w.type === outMethod).length === 0 && (
                      <SelectItem value="__none__" disabled>{t("لا توجد محافظ مسجلة", "No wallets registered")}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {(outMethod === "vodafone_cash" || outMethod === "instapay") && outBank && (() => {
                  const wal = walletAccounts.find(w => w.id === outBank);
                  const amt = parseFloat(outAmount) || 0;
                  if (!wal || !wal.maxLimit || amt <= 0) return null;
                  if (amt > wal.balance) {
                    return (
                      <p className="flex items-center gap-1 text-[10px] text-destructive mt-1.5">
                        <AlertTriangle className="w-3 h-3"/>{t("الرصيد غير كافٍ", "Insufficient balance")}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("ملاحظة (اختياري)", "Note (optional)")}</Label>
              <Input placeholder={t("ملاحظة...", "Note...")} value={outNote} onChange={e => setOutNote(e.target.value)} className="h-9 text-sm rounded-xl" />
            </div>

            {/* Submit */}
            <AnimatePresence mode="wait">
              {cashOutDone ? (
                <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-bold">{t("تم الصرف!", "Cash disbursed!")}</span>
                </motion.div>
              ) : (
                <motion.div key="b" className="flex gap-3 pt-1">
                  <Button className="flex-1 h-11 rounded-xl text-sm font-bold gap-2 bg-destructive hover:bg-destructive/90 text-white shadow-sm"
                    onClick={handleCashOut} disabled={!outAmount || !outCategory || (outMethod !== "cash" && !outBank)}>
                    <ArrowRightLeft className="w-4 h-4"/>{t("تأكيد الصرف", "Confirm Payment")}
                  </Button>
                  <Button variant="outline" className="h-11 rounded-xl px-6" onClick={() => { setCashOutOpen(false); setOutMethod("cash"); setOutBank(""); }}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Management Dialog */}
      <Dialog open={mgmtOpen} onOpenChange={setMgmtOpen}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-[42rem] max-h-[90vh] overflow-y-auto !p-0">
          <div className="bg-gradient-to-b from-primary/[0.06] to-transparent px-6 pt-6 pb-4 rounded-t-2xl border-b border-border/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5"/>{t("إدارة الحسابات", "Account Management")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 rounded-xl bg-muted/50 p-1 border border-border/30">
              <button onClick={() => setMgmtTab("banks")}
                className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all ${mgmtTab === "banks" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t("بنوك", "Banks")}
              </button>
              <button onClick={() => setMgmtTab("wallets")}
                className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all ${mgmtTab === "wallets" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t("محافظ", "Wallets")}
              </button>
              <button onClick={() => setMgmtTab("categories")}
                className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all ${mgmtTab === "categories" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t("بنود الصرف", "Categories")}
              </button>
            </div>

            {mgmtTab === "banks" && (
              <div className="space-y-3">
                {/* Add bank form */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-semibold">{t("اسم البنك", "Bank Name")}</Label>
                    <SmartInput value={newBankName} onChange={setNewBankName} extraSuggestions={bankAccounts.map(b => b.name)} className="h-9 text-sm rounded-lg" placeholder={t("مثال: بنك مصر", "e.g. Banque Misr")} />
                  </div>
                  <Button type="button" size="sm" className="h-9 rounded-lg gap-1 shrink-0"
                    onClick={() => {
                      if (!newBankName.trim()) return;
                      addBankAccount({ name: newBankName.trim(), balance: 0 });
                      setNewBankName("");
                    }}>
                    <Plus className="w-3.5 h-3.5"/>{t("إضافة", "Add")}
                  </Button>
                </div>
                {/* Bank list */}
                {bankAccounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{t("لا توجد بنوك مسجلة", "No banks registered")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {bankAccounts.map(b => (
                      <div key={b.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-card p-3">
                        {editBankId === b.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <SmartInput value={editBankName} onChange={setEditBankName} extraSuggestions={bankAccounts.map(b => b.name)} className="h-8 text-sm rounded-lg flex-1" />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-500" onClick={() => {
                              if (!editBankName.trim()) return;
                              updateBankAccount(b.id, { name: editBankName.trim() });
                              setEditBankId(null);
                            }}><CheckCircle2 className="w-3.5 h-3.5"/></Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => setEditBankId(null)}><X className="w-3.5 h-3.5"/></Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-4 h-4 text-blue-500"/>
                              <div>
                                <p className="text-sm font-medium">{b.name}</p>
                                <p className="text-[10px] text-muted-foreground">{fmtNum(b.balance)} ج.م</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditBankId(b.id); setEditBankName(b.name); }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                                <Pencil className="w-3.5 h-3.5"/>
                              </button>
                              <button onClick={() => deleteBankAccount(b.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mgmtTab === "wallets" && (
              <div className="space-y-3">
                {/* Add wallet form */}
                <div className="grid grid-cols-4 gap-2 items-end">
                  <div className="col-span-1 space-y-1">
                    <Label className="text-[10px] font-semibold">{t("النوع", "Type")}</Label>
                    <Select value={newWalType} onValueChange={v => setNewWalType(v as any)}>
                      <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vodafone_cash">{t("فودافون كاش", "Vodafone Cash")}</SelectItem>
                        <SelectItem value="instapay">{t("انستا باي", "InstaPay")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-[10px] font-semibold">{t("الاسم", "Name")}</Label>
                    <SmartInput value={newWalName} onChange={setNewWalName} extraSuggestions={walletAccounts.map(w => w.name)} className="h-9 text-sm rounded-lg" placeholder={t("مثال: محفظة الشركة", "Company wallet")} />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-[10px] font-semibold">{t("الرقم", "Number")}</Label>
                    <Input value={newWalIdent} onChange={e => setNewWalIdent(e.target.value)} className="h-9 text-sm rounded-lg" placeholder="01XXXXXXXXX" />
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] font-semibold">{t("حد أقصى", "Max Limit")} <span className="text-muted-foreground/50">{t("(اختياري)", "(opt)")}</span></Label>
                      <Input type="number" min="0" value={newWalMaxLimit} onChange={e => setNewWalMaxLimit(e.target.value)} className="h-9 text-sm rounded-lg" placeholder="0" />
                    </div>
                    <Button type="button" size="sm" className="h-9 rounded-lg gap-1 shrink-0 mt-auto"
                      onClick={() => {
                        if (!newWalName.trim() || !newWalIdent.trim()) return;
                        addWalletAccount({ name: newWalName.trim(), type: newWalType, identifier: newWalIdent.trim(), balance: 0, maxLimit: parseFloat(newWalMaxLimit) || undefined });
                        setNewWalName(""); setNewWalIdent(""); setNewWalMaxLimit("");
                      }}>
                      <Plus className="w-3.5 h-3.5"/>
                    </Button>
                  </div>
                </div>
                {/* Wallet list */}
                {walletAccounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{t("لا توجد محافظ مسجلة", "No wallets registered")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {walletAccounts.map(w => (
                      <div key={w.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-card p-3">
                        {editWalId === w.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <Select value={editWalType} onValueChange={v => setEditWalType(v as any)}>
                              <SelectTrigger className="h-8 w-28 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="vodafone_cash">Vodafone Cash</SelectItem>
                                <SelectItem value="instapay">InstaPay</SelectItem>
                              </SelectContent>
                            </Select>
                            <SmartInput value={editWalName} onChange={setEditWalName} extraSuggestions={walletAccounts.map(w => w.name)} className="h-8 text-sm rounded-lg w-24" />
                            <Input value={editWalIdent} onChange={e => setEditWalIdent(e.target.value)} className="h-8 text-sm rounded-lg w-24" />
                            <Input type="number" min="0" value={editWalMaxLimit} onChange={e => setEditWalMaxLimit(e.target.value)} className="h-8 w-20 text-sm rounded-lg" placeholder={t("حد أقصى", "Max")} />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-500" onClick={() => {
                              if (!editWalName.trim() || !editWalIdent.trim()) return;
                              updateWalletAccount(w.id, { name: editWalName.trim(), type: editWalType, identifier: editWalIdent.trim(), maxLimit: parseFloat(editWalMaxLimit) || undefined });
                              setEditWalId(null);
                            }}><CheckCircle2 className="w-3.5 h-3.5"/></Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => setEditWalId(null)}><X className="w-3.5 h-3.5"/></Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                <Smartphone className="w-4 h-4"/>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{w.name}</p>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                                  <span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${w.type === "vodafone_cash" ? "bg-orange-500/10 text-orange-500" : "bg-purple-500/10 text-purple-500"}`}>
                                    {w.type === "vodafone_cash" ? "VC" : "IP"}
                                  </span>
                                  {w.identifier}
                                  <span className="font-medium">{fmtNum(w.balance)} ج.م</span>
                                  {w.maxLimit && w.balance > w.maxLimit && (
                                    <span className="text-[8px] text-destructive font-semibold flex items-center gap-0.5"><AlertTriangle className="w-3 h-3"/>{t("تجاوز الحد", "Exceeded")}</span>
                                  )}
                                  {w.maxLimit && w.balance <= w.maxLimit && (
                                    <span className="text-[8px] text-muted-foreground/50">{t("الحد", "Limit")}: {fmtNum(w.maxLimit)}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditWalId(w.id); setEditWalName(w.name); setEditWalType(w.type); setEditWalIdent(w.identifier); setEditWalMaxLimit(w.maxLimit ? String(w.maxLimit) : ""); }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                                <Pencil className="w-3.5 h-3.5"/>
                              </button>
                              <button onClick={() => deleteWalletAccount(w.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mgmtTab === "categories" && (
              <div className="space-y-3">
                {/* Add category form */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-semibold">{t("اسم البند", "Category Name")}</Label>
                    <SmartInput value={newCatName} onChange={setNewCatName} extraSuggestions={expenseCategories} className="h-9 text-sm rounded-lg" placeholder={t("مثال: إيجار", "e.g. Rent")} />
                  </div>
                  <Button type="button" size="sm" className="h-9 rounded-lg gap-1 shrink-0"
                    onClick={() => {
                      if (!newCatName.trim()) return;
                      addExpenseCategory(newCatName.trim());
                      setNewCatName("");
                    }}>
                    <Plus className="w-3.5 h-3.5"/>{t("إضافة", "Add")}
                  </Button>
                </div>
                {/* Category list */}
                {expenseCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{t("لا توجد بنود", "No categories")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {expenseCategories.map(cat => (
                      <div key={cat} className="flex items-center justify-between rounded-xl border border-border/40 bg-card p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-destructive/5 text-destructive flex items-center justify-center">
                            <ArrowRightLeft className="w-4 h-4"/>
                          </div>
                          <p className="text-sm font-medium">{cat}</p>
                        </div>
                        <button onClick={() => deleteExpenseCategory(cat)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Accounting Report Dialog */}
      <Dialog open={repOpen} onOpenChange={v => { setRepOpen(v); if (!v) { setRepGenerated(false); } }}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-lg max-h-[90vh] overflow-y-auto !p-0">
          <div className="bg-gradient-to-b from-primary/[0.06] to-transparent px-6 pt-6 pb-4 rounded-t-2xl border-b border-border/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5"/>{t("تقرير الحسابات", "Accounting Report")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 space-y-4">
            {/* Period Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("الفترة", "Period")}</Label>
              <div className="flex gap-1 rounded-lg bg-muted/40 p-0.5 border border-border/30">
                {(["all", "today", "range"] as const).map(m => (
                  <button key={m} onClick={() => { setRepDateMode(m); setRepGenerated(false); }}
                    className={`flex-1 h-9 rounded-md text-xs font-medium transition-all ${repDateMode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {m === "all" ? t("كل الفترة", "All") : m === "today" ? t("اليوم", "Today") : t("مخصص", "Range")}
                  </button>
                ))}
              </div>
              {repDateMode === "range" && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Input type="date" value={repDateFrom} onChange={e => setRepDateFrom(e.target.value)} className="h-9 flex-1 text-xs rounded-lg" />
                  <span className="text-xs text-muted-foreground">—</span>
                  <Input type="date" value={repDateTo} onChange={e => setRepDateTo(e.target.value)} className="h-9 flex-1 text-xs rounded-lg" />
                </div>
              )}
            </div>

            {/* Sections Toggles */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("الأقسام", "Sections")}</Label>
              <div className="space-y-1.5">
                {([
                  { key: "trial" as const, label: t("ميزان المراجعة", "Trial Balance"), state: repTrial, set: setRepTrial },
                  { key: "income" as const, label: t("قائمة الدخل", "Income Statement"), state: repIncome, set: setRepIncome },
                  { key: "balance" as const, label: t("قائمة المركز المالي", "Balance Sheet"), state: repBalance, set: setRepBalance },
                ]).map(s => (
                  <label key={s.key} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/30 hover:bg-muted/20 transition-colors cursor-pointer">
                    <input type="checkbox" checked={s.state} onChange={() => { s.set(!s.state); setRepGenerated(false); }}
                      className="w-4 h-4 rounded border-border/60 text-primary focus:ring-primary/30" />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Generate / Results */}
            {!repGenerated ? (
              <Button className="w-full h-11 rounded-xl gap-2" onClick={handleGenerateReport} disabled={repGenerating}>
                {repGenerating ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t("جارٍ الإنشاء...", "Generating...")}</>
                ) : (
                  <><BarChart3 className="w-4 h-4" />{t("إنشاء التقرير", "Generate Report")}</>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="w-5 h-5" /><span className="font-bold">{t("تم إنشاء التقرير بنجاح", "Report generated successfully")}</span>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 h-11 rounded-xl gap-2" onClick={handleDownloadPDF}>
                    <Download className="w-4 h-4" />{t("تحميل PDF", "Download PDF")}
                  </Button>
                  <Button variant="outline" className="h-11 rounded-xl" onClick={() => { setRepOpen(false); setRepGenerated(false); }}>
                    {t("إغلاق", "Close")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
