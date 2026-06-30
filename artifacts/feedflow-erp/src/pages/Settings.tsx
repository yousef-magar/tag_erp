import React, { useState, useRef } from "react";
import { useAppStore, ALL_MODULE_PATHS, DEFAULT_SIDEBAR_ORDER } from "@/hooks/use-app-store";
import { useProductionStore } from "@/hooks/use-production-store";
import { logActivity } from "@/hooks/use-activity-log";
import type { WarehouseConfig } from "@/hooks/use-production-store";
import { createBackup, listBackups, restoreBackup, deleteBackup, resetAllData, exportAsJSON, importFromJSON, isAutoBackupEnabled, setAutoBackupEnabled, getAutoBackupIntervalMs, setAutoBackupIntervalMs, getBackupDirectories, addBackupDirectory, removeBackupDirectory, saveBackupToDirectories, isFolderBackupSupported, getFolderBackupIntervalMs, setFolderBackupIntervalMs, getLastFolderBackupTime, stopAutoBackupTimer, startAutoBackupTimer } from "@/lib/database";
import type { BackupInfo } from "@/lib/database";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import SmartInput from "@/components/SmartInput";
import WordsLearnedCard from "@/components/WordsLearnedCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";

import type { BackupDirRecord } from "@/lib/dexie-storage";
import {
  Settings as SettingsIcon,
  Building,
  Shield,
  Database,
  Save,
  LayoutList,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Percent,
  LayoutDashboard,
  Factory,
  Package,
  ShoppingCart,
  Users,
  Truck,
  UserCircle,
  Banknote,
  Briefcase,
  Calculator,
  FileText,
  BarChart,
  BotMessageSquare,
  UserCog,
  Warehouse,
  Plus,
  Trash2,
  Clock,
  Upload,
  X,
  TrendingUp,
  Folder,
  HardDrive,
  LucideIcon,
} from "lucide-react";

const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/production": Factory,
  "/inventory": Package,
  "/sales": ShoppingCart,
  "/customers": Users,
  "/fleet": Truck,
  "/hr": UserCircle,
  "/attendance": Clock,
  "/payroll": Banknote,
  "/marketing": Briefcase,
  "/accounting": Calculator,
  "/procurement": FileText,
  "/pricing": TrendingUp,
  "/reports": BarChart,
  "/ai-assistant": BotMessageSquare,
  "/sub-accounts": UserCog,
  "/settings": SettingsIcon,
  "/activity-log": Clock,
  "/profit": TrendingUp,
};

const MODULE_LABELS: Record<string, { ar: string; en: string }> = {
  "/": { ar: "الرئيسية", en: "Dashboard" },
  "/production": { ar: "الإنتاج", en: "Production" },
  "/inventory": { ar: "المخزون", en: "Inventory" },
  "/sales": { ar: "المبيعات", en: "Sales" },
  "/customers": { ar: "العملاء", en: "Customers" },
  "/fleet": { ar: "الأسطول", en: "Fleet & Delivery" },
  "/hr": { ar: "الموارد البشرية", en: "HR" },
  "/attendance": { ar: "الحضور", en: "Attendance" },
  "/payroll": { ar: "الرواتب", en: "Payroll" },
  "/marketing": { ar: "التسويق", en: "Marketing" },
  "/accounting": { ar: "الحسابات", en: "Accounting" },
  "/procurement": { ar: "المشتريات", en: "Procurement" },
  "/pricing": { ar: "التسعير", en: "Pricing" },
  "/profit": { ar: "الأرباح", en: "Profit" },
  "/reports": { ar: "التقارير", en: "Reports" },
  "/ai-assistant": { ar: "المساعد الذكي", en: "AI Assistant" },
  "/sub-accounts": { ar: "الحسابات الفرعية", en: "Sub Accounts" },
  "/settings": { ar: "الإعدادات", en: "Settings" },
  "/activity-log": { ar: "سجل النشاط", en: "Activity Log" },
};

export default function Settings() {
  const { t, sidebarOrder, setSidebarOrder, activeModules, setActiveModules, toggleModule, maxDiscountPercent, discountExceedAllowed, setMaxDiscountPercent, setDiscountExceedAllowed, taxEnabled, taxPercent, setTaxEnabled, setTaxPercent, overdueEnabled, overdueDays, overdueMonths, setOverdueEnabled, setOverdueDays, setOverdueMonths, payrollMonthlyReleaseDay, payrollMonthlyAdvanceDays, payrollWeeklyReleaseDay, payrollWeeklyAdvanceDays, payrollWeekStartDay, payrollMonthStartDay, setPayrollMonthlyReleaseDay, setPayrollMonthlyAdvanceDays, setPayrollWeeklyReleaseDay, setPayrollWeeklyAdvanceDays, setPayrollWeekStartDay, setPayrollMonthStartDay, companyName, companyAddress, companyLogo, setCompanyName, setCompanyAddress, setCompanyLogo, subAccounts, updateSubAccount, printPaperSize, printOrientation, printFontSize, printShowLogo, setPrintPaperSize, setPrintOrientation, setPrintFontSize, setPrintShowLogo, invoicePaperSize, invoiceOrientation, invoiceFontSize, invoiceShowLogo, setInvoicePaperSize, setInvoiceOrientation, setInvoiceFontSize, setInvoiceShowLogo, productConfig, setProductConfig, language, showSpellChecker, setShowSpellChecker, simpleInvoiceItems, setSimpleInvoiceItems } = useAppStore();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { warehouseConfigs, updateWarehouseConfig, setWarehouseConfigs } = useProductionStore();
  const [localOrder, setLocalOrder] = useState<string[]>(sidebarOrder);
  const [saved, setSaved] = useState(false);
  const [localWarehouses, setLocalWarehouses] = useState<WarehouseConfig[]>(warehouseConfigs);
  const [whSaved, setWhSaved] = useState(false);

  const [mainPwd, setMainPwd] = useState("");
  const [confirmMainPwd, setConfirmMainPwd] = useState("");
  const [subPwd, setSubPwd] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [backupDirs, setBackupDirs] = useState<BackupDirRecord[]>([]);
  const [folderBackingUp, setFolderBackingUp] = useState(false);
  const [folderBackupMsg, setFolderBackupMsg] = useState("");

  const intervalHours = Math.round(getFolderBackupIntervalMs() / 3600000);
  const [folderInterval, setFolderInterval] = useState(intervalHours);
  const [localProductConfig, setLocalProductConfig] = useState(productConfig);
  const [pcSaved, setPcSaved] = useState(false);
  const [newUnitId, setNewUnitId] = useState("");
  const [newUnitLabelAr, setNewUnitLabelAr] = useState("");
  const [newUnitLabelEn, setNewUnitLabelEn] = useState("");
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [newFieldLabelAr, setNewFieldLabelAr] = useState("");
  const [newFieldLabelEn, setNewFieldLabelEn] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "select">("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [pcMsg, setPcMsg] = useState("");

  React.useEffect(() => { loadBackupDirs(); }, []);

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      await createBackup();
      setPwdMsg(t("تم إنشاء النسخة الاحتياطية", "Backup created successfully"));
      setTimeout(() => setPwdMsg(""), 3000);
    } catch { setPwdMsg(t("خطأ في إنشاء النسخة", "Backup failed")); setTimeout(() => setPwdMsg(""), 3000); }
    setBackingUp(false);
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    setResetMsg(t("جاري حذف البيانات...", "Deleting data..."));
    try { logActivity("settings", "delete", `إعادة تعيين النظام`, `System reset`); } catch {}
    try { await resetAllData(); } catch (e) { console.error("Reset error:", e); }
    setResetMsg(t("تم حذف البيانات. سيتم إعادة تحميل الصفحة...", "Data deleted. Reloading..."));
    setTimeout(() => window.location.reload(), 1500);
  };

  const loadBackupDirs = async () => {
    try { setBackupDirs(await getBackupDirectories()); } catch {}
  };

  const handlePickFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const exists = backupDirs.some(d => d.name === dirHandle.name);
      if (exists) {
        setFolderBackupMsg(t("المجلد مضاف بالفعل", "Folder already added"));
        setTimeout(() => setFolderBackupMsg(""), 3000);
        return;
      }
      await addBackupDirectory(dirHandle.name, dirHandle);
      await loadBackupDirs();
    } catch (err: any) {
      if (err?.name !== "AbortError" && err?.name !== "SecurityError") {
        setFolderBackupMsg(t("فشل إضافة المجلد", "Failed to add folder"));
        setTimeout(() => setFolderBackupMsg(""), 3000);
      }
    }
  };

  const handleRemoveDir = async (id: number) => {
    await removeBackupDirectory(id);
    await loadBackupDirs();
  };

  const handleFolderBackup = async () => {
    setFolderBackingUp(true);
    try {
      const files = await saveBackupToDirectories();
      if (files.length > 0) {
        setFolderBackupMsg(t(`تم الحفظ: ${files[0]}`, `Saved: ${files[0]}`));
      } else {
        setFolderBackupMsg(t("لم يتم الحفظ — أضف مجلداً أولاً", "Not saved — add a folder first"));
      }
    } catch {
      setFolderBackupMsg(t("فشل النسخ للمجلد", "Folder backup failed"));
    }
    setFolderBackingUp(false);
    setTimeout(() => setFolderBackupMsg(""), 4000);
  };

  const updateMainPassword = (pwd: string) => {
    if (pwd !== confirmMainPwd) { setPwdMsg(t("كلمة المرور غير متطابقة", "Passwords don't match")); setTimeout(() => setPwdMsg(""), 3000); return; }
    localStorage.setItem("feedflow-master-password", pwd);
    setPwdMsg(t("تم تحديث كلمة المرور الرئيسية", "Main password updated"));
    setMainPwd(""); setConfirmMainPwd("");
    setTimeout(() => setPwdMsg(""), 3000);
  };

  const updateSubPassword = () => {
    if (!selectedSubId || !subPwd) return;
    updateSubAccount(selectedSubId, { password: subPwd });
    setPwdMsg(t("تم تحديث كلمة المرور", "Password updated"));
    setSubPwd(""); setSelectedSubId("");
    setTimeout(() => setPwdMsg(""), 3000);
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newOrder = [...localOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setLocalOrder(newOrder);
    setSaved(false);
  };

  const handleSave = () => {
    setSidebarOrder(localOrder);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSidebarReset = () => {
    setLocalOrder([...DEFAULT_SIDEBAR_ORDER]);
    setSaved(false);
  };

  const isDirty = JSON.stringify(localOrder) !== JSON.stringify(sidebarOrder);

  return (
    <div className="space-y-3 sm:space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("الإعدادات", "Settings")}</h1>
          <p className="text-muted-foreground mt-1">{t("إعدادات النظام والشركة", "System and company configuration")}</p>
        </div>
        <Button className="gap-2" onClick={handleSave}>
          <Save className="w-4 h-4" />
          {saved ? t("تم الحفظ ✓", "Saved ✓") : t("حفظ التغييرات", "Save Changes")}
        </Button>
      </div>

      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <Building className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">{t("بيانات الشركة", "Company Details")}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("اسم الشركة", "Company Name")}</Label>
              <SmartInput field="customer-name" value={companyName} onChange={setCompanyName} />
            </div>
            <div className="space-y-2">
              <Label>{t("العنوان", "Address")}</Label>
              <SmartInput field="customer-name" value={companyAddress} onChange={setCompanyAddress} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("شعار الشركة", "Company Logo")}</Label>
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
                {companyLogo ? (
                  <img src={companyLogo} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <Building className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { alert("الملف كبير جداً (الحد الأقصى 2 ميجابايت)"); return; }
                    const reader = new FileReader();
                    reader.onload = () => setCompanyLogo(reader.result as string);
                    reader.readAsDataURL(file);
                  }} />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => logoInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" />
                  {t("رفع شعار", "Upload Logo")}
                </Button>
                {companyLogo && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => setCompanyLogo("")}>
                    <X className="w-3.5 h-3.5" />
                    {t("إزالة", "Remove")}
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">{t("الحد الأقصى 2 ميجابايت", "Max 2 MB")}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Discount & Tax ── */}
      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <Percent className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t("الخصم والضريبة", "Discount & Tax")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("إعدادات الخصم الأقصى والضريبة على المبيعات", "Max discount & sales tax settings")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("حد الخصم", "Discount Limit")}</h3>
            <div className="space-y-2">
              <Label>{t("الحد الأقصى للخصم (%)", "Max Discount (%)")}</Label>
              <Input type="number" min="0" max="100" value={maxDiscountPercent} onChange={e => setMaxDiscountPercent(parseFloat(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground">{t("النسبة المئوية القصوى للخصم المسموح بها للفاتورة", "Maximum discount % allowed per invoice")}</p>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <Label className="cursor-pointer">{t("السماح بتجاوز الحد", "Allow Exceeding Limit")}</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t("تفعيل السماح للحسابات المصرح لها بتجاوز حد الخصم", "Let authorized accounts exceed the discount limit")}</p>
              </div>
              <Switch checked={discountExceedAllowed} onCheckedChange={setDiscountExceedAllowed} />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("ضريبة المبيعات", "Sales Tax")}</h3>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <Label className="cursor-pointer">{t("تفعيل الضريبة", "Enable Tax")}</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t("تطبيق الضريبة على فواتير المبيعات", "Apply tax on sales invoices")}</p>
              </div>
              <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
            </div>
            {taxEnabled && (
              <div className="space-y-2">
                <Label>{t("قيمة الضريبة (%)", "Tax Rate (%)")}</Label>
                <Input type="number" min="0" max="100" step="0.5" value={taxPercent} onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)} />
                <p className="text-[10px] text-muted-foreground">{t("هذه القيمة ثابتة ولا يمكن تغييرها من فواتير المبيعات", "Fixed rate — cannot be changed from sales invoices")}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Overdue Invoices ── */}
      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <Clock className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t("الفواتير المتأخرة", "Overdue Invoices")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("تحويل الفواتير المؤجلة تلقائياً إلى متأخرة بعد مدة محددة", "Auto-mark pending invoices as overdue after a period")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <Label className="cursor-pointer">{t("تفعيل المراجعة التلقائية", "Enable Auto Overdue")}</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t("فحص الفواتير المؤجلة وتحويلها لمتأخرة تلقائياً", "Auto-check and mark pending invoices as overdue")}</p>
              </div>
              <Switch checked={overdueEnabled} onCheckedChange={setOverdueEnabled} />
            </div>
            {overdueEnabled && (
              <div className="space-y-3">
                <Label>{t("المدة قبل اعتبار الفاتورة متأخرة", "Period before invoice is overdue")}</Label>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" max="365" value={overdueDays} onChange={e => setOverdueDays(parseInt(e.target.value) || 0)} className="w-20" />
                    <span className="text-sm text-muted-foreground">{t("يوم", "day(s)")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" max="120" value={overdueMonths} onChange={e => setOverdueMonths(parseInt(e.target.value) || 0)} className="w-20" />
                    <span className="text-sm text-muted-foreground">{t("شهر", "month(s)")}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {(() => {
                    const total = overdueDays + overdueMonths * 30;
                    return t(`إجمالي المدة: ${total} يوم`, `Total period: ${total} day(s)`);
                  })()}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <h3 className="text-sm font-semibold">{t("الإشعارات", "Notifications")}</h3>
            <p className="text-xs text-muted-foreground">{t("عند تحويل أي فاتورة إلى متأخرة، سيظهر إشعار في شريط العنوان مع عدد الفواتير المتأخرة", "When invoices become overdue, a notification appears in the header bar with the count")}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card p-2 rounded border border-border">
              <Clock className="w-3.5 h-3.5 text-destructive" />
              <span>{t("مثال: 3 فواتير متأخرة تتطلب مراجعة", "Example: 3 overdue invoices need review")}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Payroll Settings ── */}
      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <Banknote className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t("إعدادات الرواتب", "Payroll Settings")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("تحديد مواعيد صرف الرواتب الشهرية والأسبوعية", "Set monthly and weekly salary release dates")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("الراتب الشهري", "Monthly Salary")}</h3>
            <div className="space-y-2">
              <Label>{t("يوم الصرف (من الشهر)", "Release Day (of month)")}</Label>
              <Input type="number" min="1" max="31" value={payrollMonthlyReleaseDay} onChange={e => setPayrollMonthlyReleaseDay(parseInt(e.target.value) || 30)} />
              <p className="text-[10px] text-muted-foreground">{t("اليوم الذي يتم فيه صرف الرواتب الشهرية", "Day of month when monthly salaries are disbursed")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("بداية الشهر", "Month Start Day")}</Label>
              <Input type="number" min="1" max="31" value={payrollMonthStartDay} onChange={e => setPayrollMonthStartDay(parseInt(e.target.value) || 1)} />
              <p className="text-[10px] text-muted-foreground">{t("اليوم الذي يبدأ به الشهر لحساب الرواتب الشهرية", "The day the month starts for monthly salary calculation")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("عدد أيام التبكير للاعتماد", "Advance Days for Approval")}</Label>
              <Input type="number" min="0" max="15" value={payrollMonthlyAdvanceDays} onChange={e => setPayrollMonthlyAdvanceDays(parseInt(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground">{t("كم يوم قبل الصرف يظهر الراتب كمستحق للاعتماد", "How many days before release the salary appears as pending approval")}</p>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("الراتب الأسبوعي", "Weekly Salary")}</h3>
            <div className="space-y-2">
              <Label>{t("يوم الصرف (في الأسبوع)", "Release Day of Week")}</Label>
              <Select value={String(payrollWeeklyReleaseDay)} onValueChange={v => setPayrollWeeklyReleaseDay(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("الأحد", "Sunday")}</SelectItem>
                  <SelectItem value="1">{t("الإثنين", "Monday")}</SelectItem>
                  <SelectItem value="2">{t("الثلاثاء", "Tuesday")}</SelectItem>
                  <SelectItem value="3">{t("الأربعاء", "Wednesday")}</SelectItem>
                  <SelectItem value="4">{t("الخميس", "Thursday")}</SelectItem>
                  <SelectItem value="5">{t("الجمعة", "Friday")}</SelectItem>
                  <SelectItem value="6">{t("السبت", "Saturday")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">{t("اليوم الذي يتم فيه صرف الرواتب الأسبوعية", "Day of week when weekly salaries are disbursed")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("بداية الأسبوع", "Week Start Day")}</Label>
              <Select value={String(payrollWeekStartDay)} onValueChange={v => setPayrollWeekStartDay(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("الأحد", "Sunday")}</SelectItem>
                  <SelectItem value="1">{t("الإثنين", "Monday")}</SelectItem>
                  <SelectItem value="2">{t("الثلاثاء", "Tuesday")}</SelectItem>
                  <SelectItem value="3">{t("الأربعاء", "Wednesday")}</SelectItem>
                  <SelectItem value="4">{t("الخميس", "Thursday")}</SelectItem>
                  <SelectItem value="5">{t("الجمعة", "Friday")}</SelectItem>
                  <SelectItem value="6">{t("السبت", "Saturday")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">{t("اليوم الذي يبدأ به أسبوع العمل لحساب الرواتب الأسبوعية", "The day the work week starts for weekly salary calculation")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("عدد أيام التبكير للاعتماد", "Advance Days for Approval")}</Label>
              <Input type="number" min="0" max="6" value={payrollWeeklyAdvanceDays} onChange={e => setPayrollWeeklyAdvanceDays(parseInt(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground">{t("كم يوم قبل الصرف يظهر الراتب كمستحق للاعتماد", "How many days before release the salary appears as pending approval")}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Active Modules ── */}
      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <SettingsIcon className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t("الوحدات الفعالة", "Active Modules")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("تشغيل أو إيقاف الوحدات — الوحدات المتوقفة تختفي من القائمة الجانبية", "Enable or disable modules — disabled modules will be hidden from the sidebar")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setActiveModules([...ALL_MODULE_PATHS])}>
              {t("تفعيل الكل", "Enable All")}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30" onClick={() => setActiveModules(["/settings", "/sub-accounts"])}>
              {t("إيقاف الكل", "Disable All")}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_MODULE_PATHS.map(path => {
            const label = MODULE_LABELS[path];
            if (!label) return null;
            const enabled = activeModules.includes(path);
            const isEssential = path === "/settings" || path === "/sub-accounts";
            return (
              <div key={path} className={`flex items-center justify-between p-3 border rounded-lg bg-card ${enabled ? "border-border" : "border-destructive/20 opacity-60"}`}>
                <div>
                  <Label htmlFor={`mod-${path}`} className="cursor-pointer text-sm font-medium">{t(label.ar, label.en)}</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{path}</p>
                </div>
                <Switch
                  id={`mod-${path}`}
                  checked={enabled}
                  onCheckedChange={() => toggleModule(path)}
                  disabled={isEssential}
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">{t("لا يمكن تعطيل الإعدادات والحسابات الفرعية", "Settings and Sub Accounts cannot be disabled")}</p>
      </Card>

      {/* ── Warehouse Thresholds ── */}
      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <Warehouse className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t("المخازن ونسب التنبيه", "Warehouses & Alert Thresholds")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("حدد النسب المئوية المتبقية لكل مخزن: أخضر آمن، أصفر تحذير، أحمر حرج", "Set remaining % thresholds per warehouse: green = safe, amber = warning, red = critical")}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
            setLocalWarehouses([...localWarehouses, { id: `W${Date.now()}`, name: "", normalThreshold: 50, warningThreshold: 20 }]);
            setWhSaved(false);
          }}>
            <Plus className="w-3.5 h-3.5" />
            {t("إضافة مخزن", "Add Warehouse")}
          </Button>
        </div>

        <div className="space-y-4">
          {localWarehouses.map((wh, idx) => {
            const normalVal = wh.normalThreshold ?? 50;
            const warningVal = wh.warningThreshold ?? 20;
            return (
              <div key={wh.id} className="p-4 border border-border rounded-xl bg-card space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <SmartInput field="warehouse-name"
                      value={wh.name}
                      onChange={v => {
                        const updated = [...localWarehouses];
                        updated[idx] = { ...updated[idx], name: v };
                        setLocalWarehouses(updated);
                        setWhSaved(false);
                      }}
                      placeholder={t("اسم المخزن", "Warehouse name")}
                      className="h-8 text-sm font-medium"
                    />
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive/60 hover:text-destructive h-8 w-8 p-0"
                    onClick={() => {
                      setLocalWarehouses(localWarehouses.filter((_, i) => i !== idx));
                      setWhSaved(false);
                    }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Normal threshold */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-600 font-medium">{t("طبيعي (آمن) >= ...%", "Normal (safe) ≥")}</span>
                    <span className="font-mono font-bold text-emerald-600">{normalVal}%</span>
                  </div>
                  <Slider
                    value={[normalVal]}
                    onValueChange={([v]) => {
                      const updated = [...localWarehouses];
                      updated[idx] = { ...updated[idx], normalThreshold: v };
                      if (v <= warningVal) updated[idx].warningThreshold = Math.max(0, v - 5);
                      setLocalWarehouses(updated);
                      setWhSaved(false);
                    }}
                    min={10} max={100} step={5}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{t("حرج", "Critical")}</span>
                    <span>{t("آمن", "Safe")}</span>
                  </div>
                </div>

                {/* Warning threshold */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-600 font-medium">{t("تحذير >= ...%", "Warning ≥")}</span>
                    <span className="font-mono font-bold text-amber-600">{warningVal}%</span>
                  </div>
                  <Slider
                    value={[warningVal]}
                    onValueChange={([v]) => {
                      const updated = [...localWarehouses];
                      updated[idx] = { ...updated[idx], warningThreshold: v };
                      if (v >= normalVal) updated[idx].normalThreshold = Math.min(100, v + 5);
                      setLocalWarehouses(updated);
                      setWhSaved(false);
                    }}
                    min={0} max={95} step={5}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{t("حرج", "Critical")}</span>
                    <span>{t("طبيعي", "Normal")}</span>
                  </div>
                </div>

                {/* Visual legend */}
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div className="bg-destructive" style={{ flex: `${warningVal}%` }} />
                  <div className="bg-amber-500" style={{ flex: `${normalVal - warningVal}%` }} />
                  <div className="bg-emerald-500" style={{ flex: `${100 - normalVal}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {localWarehouses.length > 0 && (
          <div className="mt-4 flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-primary">
              {t("يتم تطبيق النسب تلقائياً على المخزون وحسابات التنبيه", "Thresholds auto-apply to inventory alert calculations")}
            </p>
            <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => {
              setWarehouseConfigs(localWarehouses);
              setWhSaved(true);
              setTimeout(() => setWhSaved(false), 2000);
            }}>
              {whSaved ? <>{t("تم ✓", "Saved ✓")}</> : <><Save className="w-3 h-3" />{t("حفظ المخازن", "Save Warehouses")}</>}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-3 sm:p-6">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <LayoutList className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold">{t("ترتيب القائمة الجانبية", "Sidebar Order")}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("اضغط على الأسهم لإعادة ترتيب العناصر", "Use the arrows to reorder items")}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSidebarReset}>
            <RotateCcw className="w-3.5 h-3.5" />
            {t("استعادة الافتراضي", "Reset Default")}
          </Button>
        </div>

        <div className="space-y-2">
          {localOrder.map((path, index) => {
            const label = MODULE_LABELS[path];
            const Icon = MODULE_ICON_MAP[path];
            if (!label || !Icon) return null;
            return (
              <div
                key={path}
                className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors group"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="flex-1 text-sm font-medium">{t(label.ar, label.en)}</span>
                <span className="text-xs text-muted-foreground/50 tabular-nums w-5 text-center">{index + 1}</span>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveItem(index, "up")}
                    disabled={index === 0}
                    className="w-6 h-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveItem(index, "down")}
                    disabled={index === localOrder.length - 1}
                    className="w-6 h-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {isDirty && (
          <div className="mt-4 flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-primary">{t("يوجد تغييرات غير محفوظة", "You have unsaved changes")}</p>
            <Button size="sm" onClick={handleSave} className="gap-1.5 h-7 text-xs">
              <Save className="w-3 h-3" />
              {t("حفظ الآن", "Save Now")}
            </Button>
          </div>
        )}
      </Card>

      {/* ── Product Settings ── */}
      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <Package className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t("إعدادات المنتج", "Product Settings")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("تكوين وحدات القياس والحقول الإضافية للمنتجات", "Configure units and extra fields for products")}
            </p>
          </div>
          <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => { setProductConfig(localProductConfig); setPcSaved(true); setTimeout(() => setPcSaved(false), 2000); }}>
            {pcSaved ? <>{t("تم ✓", "Saved ✓")}</> : <><Save className="w-3 h-3" />{t("حفظ", "Save")}</>}
          </Button>
        </div>

        {/* ── Units ── */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">{t("وحدات القياس", "Units")}</h3>
          <div className="space-y-2 mb-3">
            {localProductConfig.units.map((u, idx) => (
              <div key={u.id} className="flex items-center gap-2 p-2 border border-border rounded-lg bg-card">
                <span className="text-xs font-medium w-16">{u.id}</span>
                <span className="text-xs flex-1">{u.labelAr} / {u.labelEn}</span>
                <span className="text-[10px] text-muted-foreground">
                  {u.isBase ? t("الأساس", "Base") : u.conversionToBase ? `1 ${u.id} = ${u.conversionToBase} ${localProductConfig.units.find(x => x.isBase)?.id || ""}` : ""}
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive"
                  onClick={() => setLocalProductConfig(p => ({ ...p, units: p.units.filter((_, i) => i !== idx) }))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input value={newUnitId} onChange={e => setNewUnitId(e.target.value)} placeholder={t("المعرف", "ID")} className="h-8 text-xs w-20" />
            <Input value={newUnitLabelAr} onChange={e => setNewUnitLabelAr(e.target.value)} placeholder={t("عربي", "Arabic")} className="h-8 text-xs w-20" />
            <Input value={newUnitLabelEn} onChange={e => setNewUnitLabelEn(e.target.value)} placeholder={t("إنجليزي", "English")} className="h-8 text-xs w-20" />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => {
              if (!newUnitId || !newUnitLabelAr) return;
              setLocalProductConfig(p => ({ ...p, units: [...p.units, { id: newUnitId, labelAr: newUnitLabelAr, labelEn: newUnitLabelEn }] }));
              setNewUnitId(""); setNewUnitLabelAr(""); setNewUnitLabelEn("");
            }}>
              <Plus className="w-3 h-3" />{t("إضافة وحدة", "Add Unit")}
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            <Label className="text-xs">{t("الوحدة الافتراضية", "Default Unit")}</Label>
            <Select value={localProductConfig.defaultUnit} onValueChange={v => setLocalProductConfig(p => ({ ...p, defaultUnit: v }))}>
              <SelectTrigger className="h-9 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {localProductConfig.units.map(u => <SelectItem key={u.id} value={u.id}>{u.labelAr} ({u.id})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Package / Bag settings ── */}
        <div className="mb-6 border-t border-border/30 pt-4">
          <h3 className="text-sm font-semibold mb-3">{t("العبوة / الشيكارة", "Package / Bag")}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 border border-border rounded-lg">
              <Label className="text-xs cursor-pointer">{t("إظهار وزن العبوة", "Show Package Weight")}</Label>
              <Switch checked={localProductConfig.showPackageWeight} onCheckedChange={v => setLocalProductConfig(p => ({ ...p, showPackageWeight: v }))} />
            </div>
            {localProductConfig.showPackageWeight && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-4">
                <div className="space-y-1">
                  <Label className="text-[10px]">{t("تسمية الوزن (عربي)", "Weight Label (Arabic)")}</Label>
                  <Input value={localProductConfig.packageWeightLabelAr} onChange={e => setLocalProductConfig(p => ({ ...p, packageWeightLabelAr: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">{t("تسمية الوزن (إنجليزي)", "Weight Label (English)")}</Label>
                  <Input value={localProductConfig.packageWeightLabelEn} onChange={e => setLocalProductConfig(p => ({ ...p, packageWeightLabelEn: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">{t("قيم الوزن الافتراضية (مفصولة بفواصل)", "Weight Presets (comma-separated)")}</Label>
                  <Input value={localProductConfig.packageWeightPresets.join(", ")} onChange={e => setLocalProductConfig(p => ({ ...p, packageWeightPresets: e.target.value.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n)) }))} className="h-8 text-xs" />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between p-2 border border-border rounded-lg">
              <Label className="text-xs cursor-pointer">{t("إظهار عدد العبوات", "Show Package Count")}</Label>
              <Switch checked={localProductConfig.showPackageCount} onCheckedChange={v => setLocalProductConfig(p => ({ ...p, showPackageCount: v }))} />
            </div>
            {localProductConfig.showPackageCount && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-4">
                <div className="space-y-1">
                  <Label className="text-[10px]">{t("تسمية العدد (عربي)", "Count Label (Arabic)")}</Label>
                  <Input value={localProductConfig.packageCountLabelAr} onChange={e => setLocalProductConfig(p => ({ ...p, packageCountLabelAr: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">{t("تسمية العدد (إنجليزي)", "Count Label (English)")}</Label>
                  <Input value={localProductConfig.packageCountLabelEn} onChange={e => setLocalProductConfig(p => ({ ...p, packageCountLabelEn: e.target.value }))} className="h-8 text-xs" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Custom Fields ── */}
        <div className="border-t border-border/30 pt-4">
          <h3 className="text-sm font-semibold mb-3">{t("الحقول الإضافية", "Custom Fields")}</h3>
          {localProductConfig.customFields.length > 0 && (
            <div className="space-y-2 mb-3">
              {localProductConfig.customFields.map((f, idx) => (
                <div key={f.id} className="flex items-center gap-2 p-2 border border-border rounded-lg bg-card">
                  <span className="text-xs font-medium w-20 truncate">{f.labelAr}</span>
                  <span className="text-[10px] text-muted-foreground">{f.type}</span>
                  <div className="flex items-center gap-1.5 mr-auto">
                    <span className="text-[10px] text-muted-foreground">{f.enabled ? t("مفعل", "On") : t("معطل", "Off")}</span>
                    <Switch checked={f.enabled} onCheckedChange={v => {
                      const updated = [...localProductConfig.customFields];
                      updated[idx] = { ...updated[idx], enabled: v };
                      setLocalProductConfig(p => ({ ...p, customFields: updated }));
                    }} />
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive"
                    onClick={() => setLocalProductConfig(p => ({ ...p, customFields: p.customFields.filter((_, i) => i !== idx) }))}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Input value={newFieldLabelAr} onChange={e => setNewFieldLabelAr(e.target.value)} placeholder={t("اسم الحقل (عربي)", "Field AR")} className="h-8 text-xs w-24" />
            <Input value={newFieldLabelEn} onChange={e => setNewFieldLabelEn(e.target.value)} placeholder={t("اسم الحقل (إنجليزي)", "Field EN")} className="h-8 text-xs w-24" />
            <Select value={newFieldType} onValueChange={v => setNewFieldType(v as any)}>
              <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">{t("نص", "Text")}</SelectItem>
                <SelectItem value="number">{t("رقم", "Number")}</SelectItem>
                <SelectItem value="select">{t("اختيار", "Select")}</SelectItem>
              </SelectContent>
            </Select>
            {newFieldType === "select" && (
              <Input value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder={t("خيارات بفاصلة", "opt1,opt2")} className="h-8 text-xs w-28" />
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => {
              if (!newFieldLabelAr) return;
              const id = newFieldLabelAr.replace(/\s+/g, "_");
              setLocalProductConfig(p => ({
                ...p, customFields: [...p.customFields, {
                  id, labelAr: newFieldLabelAr, labelEn: newFieldLabelEn || newFieldLabelAr,
                  type: newFieldType, options: newFieldOptions.split(",").map(s => s.trim()).filter(Boolean),
                  required: false, enabled: true,
                }]
              }));
              setNewFieldLabelAr(""); setNewFieldLabelEn(""); setNewFieldOptions("");
            }}>
              <Plus className="w-3 h-3" />{t("إضافة حقل", "Add Field")}
            </Button>
          </div>
          {pcMsg && <p className="text-xs mt-2 text-emerald-500">{pcMsg}</p>}
        </div>
      </Card>

      <WordsLearnedCard t={t} language={language} />

      {/* ── Invoice / Sales Features ── */}
      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <FileText className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t("خصائص الفواتير", "Invoice Features")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("تخصيص شكل إدخال الأصناف وأدوات إضافية", "Customize item entry & extra tools")}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <Label className="text-xs font-medium cursor-pointer">{t("اقتراح 'هل تقصد؟'", "'Did you mean?' Suggestion")}</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("إظهار اقتراح تصحيح إملائي أسفل الحقول النصية في كل النظام", "Show spelling correction suggestion below inputs system-wide")}</p>
            </div>
            <Switch checked={showSpellChecker} onCheckedChange={setShowSpellChecker} />
          </div>
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <Label className="text-xs font-medium cursor-pointer">{t("إدخال مبسّط للأصناف", "Simple Item Entry")}</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("إظهار الأصناف في الفاتورة كاسم + كمية + سعر فقط", "Show items as name + qty + price only")}</p>
            </div>
            <Switch checked={simpleInvoiceItems} onCheckedChange={setSimpleInvoiceItems} />
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-destructive/20">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 border-b border-destructive/20 pb-3 sm:pb-4">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
          <h2 className="text-base sm:text-lg font-bold text-destructive">{t("الأمان والنسخ الاحتياطي", "Security & Backup")}</h2>
        </div>
        <div className="space-y-3 sm:space-y-6">
          {/* ── Change Password ── */}
          <div>
            <h3 className="text-sm sm:text-base font-semibold mb-3">{t("تغيير كلمة المرور", "Change Password")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("الحساب الرئيسي", "Main Account")}</Label>
                <div className="flex flex-wrap gap-2">
                  <Input type="password" placeholder={t("كلمة المرور الجديدة", "New password")} value={mainPwd} onChange={e => setMainPwd(e.target.value)}
                    className="h-9 text-xs w-full sm:w-auto" />
                  <Button variant="outline" size="sm" className="h-9 text-xs shrink-0" onClick={() => updateMainPassword(mainPwd)} disabled={!mainPwd}>
                    <Save className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("تأكيد كلمة المرور", "Confirm Password")}</Label>
                <Input type="password" placeholder={t("أعد إدخال كلمة المرور", "Re-enter password")} value={confirmMainPwd} onChange={e => setConfirmMainPwd(e.target.value)}
                  className="h-9 text-xs w-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("حساب فرعي (اختياري)", "Sub Account (optional)")}</Label>
                <div className="flex flex-wrap gap-2">
                  <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                    <SelectTrigger className="h-9 text-xs w-full sm:w-auto">
                      <SelectValue placeholder={t("اختر حساباً", "Select account")} />
                    </SelectTrigger>
                    <SelectContent>
                      {subAccounts.filter(sa => sa.active).map(sa => (
                        <SelectItem key={sa.id} value={sa.id}>{sa.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="password" placeholder={t("كلمة جديدة", "New pwd")} value={subPwd} onChange={e => setSubPwd(e.target.value)}
                    className="h-9 text-xs w-full sm:w-auto" />
                  <Button variant="outline" size="sm" className="h-9 text-xs shrink-0" onClick={() => updateSubPassword()} disabled={!selectedSubId || !subPwd}>
                    <Save className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            {pwdMsg && <p className="text-xs mt-2 text-emerald-500">{pwdMsg}</p>}
          </div>

          {/* ── Backup ── */}
          <div className="border-t border-border/30 pt-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3">{t("النسخ الاحتياطي", "Backup & Restore")}</h3>
            <div className="flex items-center gap-3 mb-3 p-2.5 rounded-lg bg-muted/20">
              <Switch checked={isAutoBackupEnabled()} onCheckedChange={setAutoBackupEnabled} />
              <div className="flex items-center gap-2 flex-1">
                <div>
                  <p className="text-xs font-medium">{t("نسخ احتياطي تلقائي", "Auto Backup")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("إنشاء نسخة تلقائياً", "Create backup automatically")}</p>
                </div>
                {(() => {
                  const curH = Math.round(getAutoBackupIntervalMs() / 3600000);
                  return (
                    <Select value={String(curH)} onValueChange={v => setAutoBackupIntervalMs(parseInt(v) * 3600000)}>
                      <SelectTrigger className="h-7 w-[90px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 4, 6, 8, 12, 24].map(h => (
                          <SelectItem key={h} value={String(h)}>{h} {t("ساعة", "hr")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
            </div>
            {!showBackups ? (
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2 h-9 text-xs" onClick={handleBackup} disabled={backingUp}>
                  <Database className="w-3.5 h-3.5" />
                  {backingUp ? t("جاري...", "Processing...") : t("نسخة احتياطية الآن", "Backup Now")}
                </Button>
                <Button variant="outline" className="gap-2 h-9 text-xs" onClick={() => { listBackups().then(setBackups); setShowBackups(true); }}>
                  <Database className="w-3.5 h-3.5" />
                  {t("عرض النسخ", "View Backups")}
                </Button>
                <Button variant="outline" className="gap-2 h-9 text-xs" onClick={async () => {
                  const blob = await exportAsJSON();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `feedflow-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Upload className="w-3.5 h-3.5 rotate-180" />
                  {t("تصدير JSON", "Export JSON")}
                </Button>
                <label className="cursor-pointer">
                  <Button variant="outline" className="gap-2 h-9 text-xs pointer-events-none">
                    <Upload className="w-3.5 h-3.5" />
                    {t("استيراد JSON", "Import JSON")}
                  </Button>
                  <input type="file" accept=".json" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const result = await importFromJSON(file);
                      alert(t(`تم استيراد ${result.keysRestored} مفتاح`, `Imported ${result.keysRestored} keys`));
                      window.location.reload();
                    } catch (err) { alert(t("خطأ في الاستيراد", "Import failed") + ": " + String(err)); }
                    e.target.value = "";
                  }} />
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{t("النسخ الاحتياطية", "Backups")}</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowBackups(false)}>
                    {t("إخفاء", "Hide")}
                  </Button>
                </div>
                {backups.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">{t("لا توجد نسخ احتياطية", "No backups found")}</p>
                ) : (
                    backups.map(b => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                      <div>
                        <span>{new Date(b.timestamp).toLocaleString("ar-EG")}</span>
                        <span className="text-[9px] text-muted-foreground mr-2">
                          {b.keyCount || "?"} keys · {(b.sizeBytes ? (b.sizeBytes / 1024).toFixed(1) + " KB" : "")}
                          {b.autoBackup ? ` · ${t("تلقائي", "auto")}` : ""}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"
                          onClick={() => { if (confirm(t("استعادة هذا الإصدار؟", "Restore this version?"))) restoreBackup(b.id).then(() => window.location.reload()); }}>
                          {t("استعادة", "Restore")}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-destructive"
                          onClick={async () => { await deleteBackup(b.id); setBackups(prev => prev.filter(p => p.id !== b.id)); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Folder Backup ── */}
          <div className="border-t border-border/30 pt-6" onFocus={loadBackupDirs} tabIndex={-1}>
            <h3 className="text-sm sm:text-base font-semibold mb-3">{t("النسخ الاحتياطي للمجلد", "Folder Backup")}</h3>
            <p className="text-[10px] text-muted-foreground mb-3">
              {t("يحفظ نسخة كاملة من كل البيانات (المخازن المحلية + Dexie) إلى مجلد على جهازك", "Saves a complete copy of ALL data (localStorage + Dexie) to a folder on your machine")}
            </p>

            {/* Folder list */}
            <div className="space-y-1.5 mb-3">
              {backupDirs.map(dir => (
                <div key={dir.id} className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-lg text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <HardDrive className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{dir.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive shrink-0"
                    onClick={() => handleRemoveDir(dir.id!)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add / Backup buttons */}
            <div className="flex flex-wrap gap-2 mb-2">
              {isFolderBackupSupported() ? (
                <Button variant="outline" className="gap-1.5 h-8 text-xs" onClick={handlePickFolder}>
                  <Folder className="w-3.5 h-3.5" />
                  {t("إضافة مجلد", "Add Folder")}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                  {t("المتصفح لا يدعم حفظ المجلدات — استخدم Chrome أو Edge", "Browser doesn't support folder saving — use Chrome or Edge")}
                </p>
              )}
              <Button variant="outline" className="gap-1.5 h-8 text-xs" onClick={handleFolderBackup} disabled={folderBackingUp}>
                <HardDrive className="w-3.5 h-3.5" />
                {folderBackingUp ? t("جاري...", "Processing...") : t("نسخ للمجلد الآن", "Backup to Folders Now")}
              </Button>
            </div>

            {/* Auto-backup interval */}
            <div className="flex items-center gap-3 mb-2 p-2.5 rounded-lg bg-muted/20">
              <div className="flex items-center gap-2 flex-1">
                <p className="text-xs font-medium">{t("نسخ احتياطي تلقائي كل", "Auto backup every")}</p>
                <Select value={String(folderInterval)} onValueChange={v => {
                  const hours = parseInt(v);
                  setFolderInterval(hours);
                  setFolderBackupIntervalMs(hours * 3600000);
                  stopAutoBackupTimer();
                  startAutoBackupTimer();
                }}>
                  <SelectTrigger className="h-7 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 4, 6, 8, 12, 24].map(h => (
                      <SelectItem key={h} value={String(h)}>{h} {t("ساعة", "hr")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Last backup time */}
            {(() => {
              const lastTime = getLastFolderBackupTime();
              if (!lastTime) return null;
              const hoursAgo = ((Date.now() - lastTime) / 3600000).toFixed(1);
              return (
                <p className="text-[10px] text-muted-foreground">
                  {t(`آخر نسخة: ${new Date(lastTime).toLocaleString("ar-EG")} (منذ ${hoursAgo} ساعة)`, `Last backup: ${new Date(lastTime).toLocaleString()} (${hoursAgo} hours ago)`)}
                </p>
              );
            })()}

            {folderBackupMsg && <p className="text-xs mt-1 text-emerald-500">{folderBackupMsg}</p>}
          </div>

          {/* ── Print Settings ── */}
          <div className="border-t border-border/30 pt-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3">{t("إعدادات الطباعة", "Print Settings")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("حجم الورق", "Paper Size")}</Label>
                <Select value={printPaperSize} onValueChange={setPrintPaperSize}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                    <SelectItem value="A7">A7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("اتجاه الطباعة", "Orientation")}</Label>
                <Select value={printOrientation} onValueChange={setPrintOrientation}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">{t("عمودي", "Portrait")}</SelectItem>
                    <SelectItem value="landscape">{t("أفقي", "Landscape")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("حجم الخط", "Font Size")}</Label>
                <Select value={String(printFontSize)} onValueChange={v => setPrintFontSize(Number(v))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[8, 9, 10, 11, 12, 14, 16].map(s => <SelectItem key={s} value={String(s)}>{s}pt</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("إظهار الشعار", "Show Logo")}</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={printShowLogo} onCheckedChange={setPrintShowLogo} />
                  <span className="text-xs text-muted-foreground">{printShowLogo ? t("نعم", "Yes") : t("لا", "No")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Invoice Print Settings ── */}
          <div className="border-t border-border/30 pt-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3">{t("إعدادات طباعة الفواتير", "Invoice Print Settings")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("حجم الورق", "Paper Size")}</Label>
                <Select value={invoicePaperSize} onValueChange={setInvoicePaperSize}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                    <SelectItem value="A7">A7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("اتجاه الطباعة", "Orientation")}</Label>
                <Select value={invoiceOrientation} onValueChange={setInvoiceOrientation}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">{t("عمودي", "Portrait")}</SelectItem>
                    <SelectItem value="landscape">{t("أفقي", "Landscape")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("حجم الخط", "Font Size")}</Label>
                <Select value={String(invoiceFontSize)} onValueChange={v => setInvoiceFontSize(Number(v))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[8, 9, 10, 11, 12, 14, 16].map(s => <SelectItem key={s} value={String(s)}>{s}pt</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("إظهار الشعار", "Show Logo")}</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={invoiceShowLogo} onCheckedChange={setInvoiceShowLogo} />
                  <span className="text-xs text-muted-foreground">{invoiceShowLogo ? t("نعم", "Yes") : t("لا", "No")}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border/30 pt-6">
            <h3 className="text-sm sm:text-base font-semibold text-destructive mb-3">{t("إعادة تعيين النظام", "Reset System")}</h3>
            <p className="text-xs text-muted-foreground mb-3">{t("سيتم حذف جميع البيانات وإعادة تعيين النظام إلى حالته الأولية", "All data will be deleted and the system will reset to its initial state")}</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="destructive" className="gap-2 h-9 text-xs" onClick={() => setShowResetConfirm(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                {t("حذف كل البيانات", "Delete All Data")}
              </Button>
              {showResetConfirm && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive font-semibold">{t("متأكد؟", "Are you sure?")}</span>
                  <Button variant="destructive" size="sm" className="h-9 text-xs" onClick={handleReset}>نعم</Button>
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setShowResetConfirm(false)}>{t("إلغاء", "Cancel")}</Button>
                </div>
              )}
            </div>
            {resetMsg && <p className="text-xs mt-2">{resetMsg}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
