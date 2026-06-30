import { create } from "zustand";
import type { SubstitutionResult } from "@/lib/substitution-engine";
import type { SubstitutionApprovalData } from "@/components/production/SubstitutionApprovalDialog";
import { api } from "@/lib/api";
import { logActivity } from "./use-activity-log";

type Language = "ar" | "en";
type Theme = "dark" | "light";

export type Permission = "none" | "view" | "full";

export interface FeatureDef {
  id: string;
  labelAr: string;
  labelEn: string;
}

export const SUB_ACCOUNT_FEATURES: Record<string, FeatureDef[]> = {
  "/": [
    { id: "dashboard.view", labelAr: "عرض لوحة المعلومات", labelEn: "View Dashboard" },
  ],
  "/production": [
    { id: "production.view", labelAr: "عرض الإنتاج", labelEn: "View Production" },
    { id: "production.create", labelAr: "إنشاء خطة إنتاج", labelEn: "Create Production" },
    { id: "production.edit", labelAr: "تعديل الإنتاج", labelEn: "Edit Production" },
    { id: "production.delete", labelAr: "حذف الإنتاج", labelEn: "Delete Production" },
    { id: "production.formulas", labelAr: "إدارة الخلطات", labelEn: "Manage Formulas" },
    { id: "production.substitutions", labelAr: "البدائل والموافقات", labelEn: "Substitutions & Approvals" },
    { id: "production.print_report", labelAr: "طباعة تقرير الإنتاج", labelEn: "Print Production Report" },
  ],
  "/inventory": [
    { id: "inventory.view", labelAr: "عرض المخزون", labelEn: "View Inventory" },
    { id: "inventory.adjust", labelAr: "تسوية المخزون", labelEn: "Adjust Stock" },
    { id: "inventory.materials", labelAr: "إدارة الخامات", labelEn: "Manage Materials" },
    { id: "inventory.print_report", labelAr: "طباعة تقرير المخزون", labelEn: "Print Inventory Report" },
  ],
  "/sales": [
    { id: "sales.view", labelAr: "عرض الفواتير", labelEn: "View Invoices" },
    { id: "sales.create", labelAr: "إنشاء فاتورة", labelEn: "Create Invoice" },
    { id: "sales.edit", labelAr: "تعديل الفاتورة", labelEn: "Edit Invoice" },
    { id: "sales.delete", labelAr: "حذف الفاتورة", labelEn: "Delete Invoice" },
    { id: "sales.close", labelAr: "إغلاق الفاتورة", labelEn: "Close Invoice" },
    { id: "sales.returns", labelAr: "إدارة المرتجعات", labelEn: "Manage Returns" },
    { id: "sales.discount", labelAr: "تجاوز حد الخصم", labelEn: "Override Discount Limit" },
    { id: "sales.print_report", labelAr: "طباعة تقرير المبيعات", labelEn: "Print Sales Report" },
  ],
  "/customers": [
    { id: "customers.view", labelAr: "عرض العملاء", labelEn: "View Customers" },
    { id: "customers.create", labelAr: "إضافة عميل", labelEn: "Add Customer" },
    { id: "customers.edit", labelAr: "تعديل العميل", labelEn: "Edit Customer" },
    { id: "customers.delete", labelAr: "حذف العميل", labelEn: "Delete Customer" },
    { id: "customers.print_report", labelAr: "طباعة تقرير العملاء", labelEn: "Print Customers Report" },
  ],
  "/fleet": [
    { id: "fleet.view", labelAr: "عرض الأسطول", labelEn: "View Fleet" },
    { id: "fleet.create", labelAr: "إضافة توصيلة", labelEn: "Add Delivery" },
    { id: "fleet.edit", labelAr: "تعديل التوصيلة", labelEn: "Edit Delivery" },
    { id: "fleet.delete", labelAr: "حذف التوصيلة", labelEn: "Delete Delivery" },
    { id: "fleet.update_status", labelAr: "تحديث حالة التوصيلة", labelEn: "Update Delivery Status" },
    { id: "fleet.print_report", labelAr: "طباعة تقرير الأسطول", labelEn: "Print Fleet Report" },
  ],
  "/hr": [
    { id: "hr.view", labelAr: "عرض الموظفين", labelEn: "View Employees" },
    { id: "hr.create", labelAr: "إضافة موظف", labelEn: "Add Employee" },
    { id: "hr.edit", labelAr: "تعديل الموظف", labelEn: "Edit Employee" },
    { id: "hr.delete", labelAr: "حذف الموظف", labelEn: "Delete Employee" },
    { id: "hr.shifts", labelAr: "إدارة الورديات", labelEn: "Manage Shifts" },
    { id: "hr.departments", labelAr: "إدارة الأقسام", labelEn: "Manage Departments" },
    { id: "hr.print_report", labelAr: "طباعة تقرير الموارد البشرية", labelEn: "Print HR Report" },
  ],
  "/attendance": [
    { id: "attendance.view", labelAr: "عرض الحضور", labelEn: "View Attendance" },
    { id: "attendance.record", labelAr: "تسجيل الحضور", labelEn: "Record Attendance" },
    { id: "attendance.edit", labelAr: "تعديل الحضور", labelEn: "Edit Attendance" },
    { id: "attendance.print_report", labelAr: "طباعة تقرير الحضور", labelEn: "Print Attendance Report" },
  ],
  "/payroll": [
    { id: "payroll.view", labelAr: "عرض الرواتب", labelEn: "View Payroll" },
    { id: "payroll.approve_salary", labelAr: "اعتماد الراتب", labelEn: "Approve Salary" },
    { id: "payroll.view_commission", labelAr: "عرض العمولات", labelEn: "View Commissions" },
    { id: "payroll.approve_commission", labelAr: "اعتماد العمولة", labelEn: "Approve Commission" },
    { id: "payroll.view_incentive", labelAr: "عرض الحوافز", labelEn: "View Incentives" },
    { id: "payroll.approve_incentive", labelAr: "اعتماد الحافز", labelEn: "Approve Incentive" },
    { id: "payroll.print_report", labelAr: "طباعة تقرير الرواتب", labelEn: "Print Payroll Report" },
  ],
  "/marketing": [
    { id: "marketing.view", labelAr: "عرض المسوقين", labelEn: "View Marketers" },
    { id: "marketing.create", labelAr: "إضافة مسوق", labelEn: "Add Marketer" },
    { id: "marketing.edit", labelAr: "تعديل المسوق", labelEn: "Edit Marketer" },
    { id: "marketing.delete", labelAr: "حذف المسوق", labelEn: "Delete Marketer" },
    { id: "marketing.print_report", labelAr: "طباعة تقرير التسويق", labelEn: "Print Marketing Report" },
  ],
  "/accounting": [
    { id: "accounting.view", labelAr: "عرض الحسابات", labelEn: "View Accounting" },
    { id: "accounting.transaction_create", labelAr: "إضافة معاملة", labelEn: "Add Transaction" },
    { id: "accounting.transaction_edit", labelAr: "تعديل المعاملة", labelEn: "Edit Transaction" },
    { id: "accounting.transaction_delete", labelAr: "حذف المعاملة", labelEn: "Delete Transaction" },
    { id: "accounting.banks", labelAr: "إدارة البنوك", labelEn: "Manage Banks" },
    { id: "accounting.wallets", labelAr: "إدارة المحافظ", labelEn: "Manage Wallets" },
    { id: "accounting.expenses", labelAr: "إدارة المصروفات", labelEn: "Manage Expenses" },
    { id: "accounting.print_report", labelAr: "طباعة تقرير الحسابات", labelEn: "Print Accounting Report" },
  ],
  "/procurement": [
    { id: "procurement.view", labelAr: "عرض المشتريات", labelEn: "View Procurement" },
    { id: "procurement.create", labelAr: "إنشاء أمر شراء", labelEn: "Create Order" },
    { id: "procurement.edit", labelAr: "تعديل الأمر", labelEn: "Edit Order" },
    { id: "procurement.delete", labelAr: "حذف الأمر", labelEn: "Delete Order" },
    { id: "procurement.receive", labelAr: "استلام الطلب", labelEn: "Receive Order" },
    { id: "procurement.print_report", labelAr: "طباعة تقرير المشتريات", labelEn: "Print Procurement Report" },
  ],
  "/pricing": [
    { id: "pricing.view", labelAr: "عرض التسعير", labelEn: "View Pricing" },
    { id: "pricing.edit", labelAr: "تعديل الأسعار", labelEn: "Edit Prices" },
    { id: "pricing.costs", labelAr: "عرض التكاليف", labelEn: "View Costs" },
    { id: "pricing.print_report", labelAr: "طباعة تقرير التسعير", labelEn: "Print Pricing Report" },
  ],
  "/profit": [
    { id: "profit.view", labelAr: "عرض الأرباح", labelEn: "View Profit" },
    { id: "profit.print_report", labelAr: "طباعة تقرير الأرباح", labelEn: "Print Profit Report" },
  ],
  "/reports": [
    { id: "reports.view", labelAr: "عرض التقارير", labelEn: "View Reports" },
    { id: "reports.export", labelAr: "تصدير التقارير", labelEn: "Export Reports" },
    { id: "reports.print_report", labelAr: "طباعة التقرير الشامل", labelEn: "Print Comprehensive Report" },
  ],
  "/ai-assistant": [
    { id: "ai_assistant.view", labelAr: "عرض المساعد الذكي", labelEn: "View AI Assistant" },
  ],
  "/settings": [
    { id: "settings.view", labelAr: "عرض الإعدادات", labelEn: "View Settings" },
    { id: "settings.edit", labelAr: "تعديل الإعدادات", labelEn: "Edit Settings" },
  ],
  "/sub-accounts": [
    { id: "sub_accounts.view", labelAr: "عرض الحسابات الفرعية", labelEn: "View Sub Accounts" },
    { id: "sub_accounts.create", labelAr: "إضافة حساب فرعي", labelEn: "Add Sub Account" },
    { id: "sub_accounts.edit", labelAr: "تعديل حساب فرعي", labelEn: "Edit Sub Account" },
    { id: "sub_accounts.delete", labelAr: "حذف حساب فرعي", labelEn: "Delete Sub Account" },
    { id: "sub_accounts.permissions", labelAr: "إدارة الصلاحيات", labelEn: "Manage Permissions" },
  ],
  "/activity-log": [
    { id: "activity_log.view", labelAr: "عرض سجل النشاط", labelEn: "View Activity Log" },
    { id: "activity_log.export", labelAr: "تصدير السجل", labelEn: "Export Activity Log" },
    { id: "activity_log.clear", labelAr: "مسح السجل", labelEn: "Clear Activity Log" },
  ],
  "/invoices": [
    { id: "invoices.view", labelAr: "عرض الفواتير", labelEn: "View Invoices" },
    { id: "invoices.create", labelAr: "إنشاء فاتورة", labelEn: "Create Invoice" },
    { id: "invoices.edit", labelAr: "تعديل الفاتورة", labelEn: "Edit Invoice" },
    { id: "invoices.delete", labelAr: "حذف الفاتورة", labelEn: "Delete Invoice" },
    { id: "invoices.corrector", labelAr: "المصحح اللغوي", labelEn: "Spell Checker" },
  ],
};

export interface SubAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  active: boolean;
  permissions: Record<string, Permission>;
  canExceedDiscountLimit: boolean;
  canAccessPricing: boolean;
  canAccessHR: boolean;
  canAccessPayroll: boolean;
  featurePermissions: Record<string, boolean>;
  createdAt: string;
  securityQuestions?: { q1: string; a1: string; q2: string; a2: string; q3: string; a3: string };
}

const ALL_MODULE_PATHS = [
  "/", "/production", "/inventory", "/sales", "/customers",
  "/fleet", "/hr", "/attendance", "/payroll", "/marketing", "/accounting",
  "/procurement", "/pricing", "/profit", "/reports", "/ai-assistant", "/settings", "/sub-accounts",
  "/activity-log", "/invoices",
];

const DEFAULT_SIDEBAR_ORDER = [
  "/", "/production", "/inventory", "/sales", "/customers",
  "/fleet", "/hr", "/attendance", "/payroll", "/marketing", "/accounting",
  "/procurement", "/pricing", "/profit", "/reports", "/invoices", "/ai-assistant", "/sub-accounts", "/settings",
  "/activity-log"
];

export interface ProductUnit {
  id: string;
  labelAr: string;
  labelEn: string;
  isBase?: boolean;
  conversionToBase?: number;
}

export interface ProductCustomField {
  id: string;
  labelAr: string;
  labelEn: string;
  type: "text" | "number" | "select";
  options: string[];
  required: boolean;
  enabled: boolean;
}

export interface ProductConfig {
  units: ProductUnit[];
  defaultUnit: string;
  showPackageWeight: boolean;
  showPackageCount: boolean;
  packageWeightLabelAr: string;
  packageWeightLabelEn: string;
  packageCountLabelAr: string;
  packageCountLabelEn: string;
  packageWeightPresets: number[];
  customFields: ProductCustomField[];
}

export interface OverdueAlert {
  invoiceId: string;
  customerName: string;
  daysOverdue: number;
  date: string;
  total: number;
}

interface AppState {
  language: Language;
  theme: Theme;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  t: (ar: string, en: string) => string;
  sidebarOrder: string[];
  setSidebarOrder: (order: string[]) => void;
  activeModules: string[];
  setActiveModules: (modules: string[]) => void;
  toggleModule: (path: string) => void;
  loggedInSubAccountId: string | null;
  login: (email: string, password: string) => boolean | Promise<boolean>;
  logout: () => void;
  hasFeaturePermission: (featureId: string) => boolean;
  subAccounts: SubAccount[];
  addSubAccount: (account: Omit<SubAccount, "id" | "createdAt">) => void;
  updateSubAccount: (id: string, updates: Partial<SubAccount>) => void;
  deleteSubAccount: (id: string) => void;
  // Global substitution alerts
  substitutionAlerts: SubstitutionResult[];
  substitutionDialogOpen: boolean;
  substitutionDialogData: SubstitutionApprovalData | null;
  substitutionLoading: boolean;
  onApproveSubstitution: ((requestId: string) => Promise<void>) | null;
  onRejectSubstitution: ((requestId: string) => Promise<void>) | null;
  setSubstitutionAlerts: (alerts: SubstitutionResult[]) => void;
  openSubstitutionDialog: (data: SubstitutionApprovalData) => void;
  closeSubstitutionDialog: () => void;
  setSubstitutionLoading: (loading: boolean) => void;
  registerSubstitutionHandlers: (
    approve: (requestId: string) => Promise<void>,
    reject: (requestId: string) => Promise<void>,
  ) => void;
  // Discount settings
  maxDiscountPercent: number;
  discountExceedAllowed: boolean;
  setMaxDiscountPercent: (val: number) => void;
  setDiscountExceedAllowed: (val: boolean) => void;
  // Tax settings
  taxEnabled: boolean;
  taxPercent: number;
  setTaxEnabled: (val: boolean) => void;
  setTaxPercent: (val: number) => void;
  // Overdue invoice settings
  overdueEnabled: boolean;
  overdueDays: number;
  overdueMonths: number;
  setOverdueEnabled: (val: boolean) => void;
  setOverdueDays: (val: number) => void;
  setOverdueMonths: (val: number) => void;
  overdueAlerts: OverdueAlert[];
  setOverdueAlerts: (alerts: OverdueAlert[]) => void;
  dismissOverdueAlert: (invoiceId: string) => void;
  // Bank accounts & payment methods
  bankAccounts: { id: string; name: string; balance: number }[];
  walletAccounts: { id: string; name: string; type: "vodafone_cash" | "instapay"; identifier: string; balance: number; maxLimit?: number }[];
  paymentMethods: { id: string; labelAr: string; labelEn: string }[];
  addBankAccount: (account: { name: string; balance: number }) => void;
  updateBankAccount: (id: string, updates: { name: string }) => void;
  updateBankBalance: (id: string, delta: number) => void;
  deleteBankAccount: (id: string) => void;
  addWalletAccount: (wallet: { name: string; type: "vodafone_cash" | "instapay"; identifier: string; balance: number; maxLimit?: number }) => void;
  updateWalletAccount: (id: string, updates: { name: string; type: "vodafone_cash" | "instapay"; identifier: string; maxLimit?: number }) => void;
  updateWalletBalance: (id: string, delta: number) => void;
  deleteWalletAccount: (id: string) => void;
  // Expense categories
  expenseCategories: string[];
  addExpenseCategory: (name: string) => void;
  deleteExpenseCategory: (name: string) => void;
  // Payroll settings
  payrollMonthlyReleaseDay: number;
  payrollMonthlyAdvanceDays: number;
  payrollWeeklyReleaseDay: number;
  payrollWeeklyAdvanceDays: number;
  payrollWeekStartDay: number; // 0=Sun, 1=Mon, ..., 6=Sat
  payrollMonthStartDay: number; // 1-31
  setPayrollMonthlyReleaseDay: (val: number) => void;
  // Company info
  companyName: string;
  companyAddress: string;
  companyLogo: string;
  setCompanyName: (val: string) => void;
  setCompanyAddress: (val: string) => void;
  setCompanyLogo: (val: string) => void;
  setPayrollMonthlyAdvanceDays: (val: number) => void;
  setPayrollWeeklyReleaseDay: (val: number) => void;
  setPayrollWeeklyAdvanceDays: (val: number) => void;
  setPayrollWeekStartDay: (val: number) => void;
  setPayrollMonthStartDay: (val: number) => void;
  // Print settings (reports)
  printPaperSize: string;
  printOrientation: string;
  printFontSize: number;
  printShowLogo: boolean;
  setPrintPaperSize: (val: string) => void;
  setPrintOrientation: (val: string) => void;
  setPrintFontSize: (val: number) => void;
  setPrintShowLogo: (val: boolean) => void;
  // Invoice print settings
  invoicePaperSize: string;
  invoiceOrientation: string;
  invoiceFontSize: number;
  invoiceShowLogo: boolean;
  setInvoicePaperSize: (val: string) => void;
  setInvoiceOrientation: (val: string) => void;
  setInvoiceFontSize: (val: number) => void;
  setInvoiceShowLogo: (val: boolean) => void;
  // Product config
  productConfig: ProductConfig;
  setProductConfig: (config: ProductConfig) => void;
  // Invoice features
  showSpellChecker: boolean;
  setShowSpellChecker: (val: boolean) => void;
  simpleInvoiceItems: boolean;
  setSimpleInvoiceItems: (val: boolean) => void;
  // Security questions
  securityQuestions: { q1: string; a1: string; q2: string; a2: string; q3: string; a3: string } | null;
  updateSecurityAnswers: (q1: string, a1: string, q2: string, a2: string, q3: string, a3: string) => void;
  verifySecurityAnswer: (num: 1|2|3, answer: string) => boolean;
  resetPasswordWithSecurity: (newPassword: string) => void;
}

const getInitialLang = (): Language => {
  const saved = localStorage.getItem("feedflow-lang") as Language;
  return saved || "ar";
};

const getInitialTheme = (): Theme => {
  const saved = localStorage.getItem("feedflow-theme") as Theme;
  return saved || "dark";
};

const getInitialSidebarOrder = (): string[] => {
  try {
    const saved = localStorage.getItem("feedflow-sidebar-order");
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      const allPaths = new Set(DEFAULT_SIDEBAR_ORDER);
      const savedSet = new Set(parsed);
      const newPaths = DEFAULT_SIDEBAR_ORDER.filter(p => !savedSet.has(p));
      const validPaths = parsed.filter(p => allPaths.has(p));
      return [...validPaths, ...newPaths];
    }
  } catch {}
  return DEFAULT_SIDEBAR_ORDER;
};

const getInitialMaxDiscount = (): number => {
  const saved = localStorage.getItem("feedflow-max-discount");
  return saved ? parseFloat(saved) : 10;
};
const getInitialDiscountExceed = (): boolean => {
  return localStorage.getItem("feedflow-discount-exceed") === "true";
};
const getInitialTaxEnabled = (): boolean => {
  return localStorage.getItem("feedflow-tax-enabled") !== "false";
};
const getInitialTaxPercent = (): number => {
  const saved = localStorage.getItem("feedflow-tax-percent");
  return saved ? parseFloat(saved) : 14;
};
const getInitialOverdueEnabled = (): boolean => {
  return localStorage.getItem("feedflow-overdue-enabled") !== "false";
};
const getInitialOverdueDays = (): number => {
  const saved = localStorage.getItem("feedflow-overdue-days");
  return saved ? parseInt(saved) : 30;
};
const getInitialOverdueMonths = (): number => {
  const saved = localStorage.getItem("feedflow-overdue-months");
  return saved ? parseInt(saved) : 0;
};

const getInitialActiveModules = (): string[] => {
  try {
    const saved = localStorage.getItem("feedflow-active-modules");
    if (saved) return JSON.parse(saved) as string[];
  } catch {}
  return [...ALL_MODULE_PATHS];
};

const getInitialSubAccounts = (): SubAccount[] => {
  try {
    const saved = localStorage.getItem("feedflow-sub-accounts");
    if (saved) {
      const parsed = JSON.parse(saved) as SubAccount[];
      return parsed.map(a => ({
        ...a,
        featurePermissions: a.featurePermissions || {},
      }));
    }
  } catch {}
  return [];
};

const getInitialCompanyName = (): string => {
  return localStorage.getItem("feedflow-company-name") || "مصنع الوطنية للأعلاف";
};

const getInitialCompanyAddress = (): string => {
  return localStorage.getItem("feedflow-company-address") || "المنطقة الصناعية";
};

const getInitialCompanyLogo = (): string => {
  return localStorage.getItem("feedflow-company-logo") || "";
};

const getInitialPrintPaperSize = (): string => {
  return localStorage.getItem("feedflow-print-paper-size") || "A4";
};
const getInitialPrintOrientation = (): string => {
  return localStorage.getItem("feedflow-print-orientation") || "portrait";
};
const getInitialPrintFontSize = (): number => {
  const saved = localStorage.getItem("feedflow-print-font-size");
  return saved ? parseInt(saved) : 11;
};
const getInitialPrintShowLogo = (): boolean => {
  return localStorage.getItem("feedflow-print-show-logo") !== "false";
};
const getInitialInvoicePaperSize = (): string => {
  return localStorage.getItem("feedflow-invoice-paper-size") || "A4";
};
const getInitialInvoiceOrientation = (): string => {
  return localStorage.getItem("feedflow-invoice-orientation") || "portrait";
};
const getInitialInvoiceFontSize = (): number => {
  const saved = localStorage.getItem("feedflow-invoice-font-size");
  return saved ? parseInt(saved) : 11;
};
const getInitialInvoiceShowLogo = (): boolean => {
  return localStorage.getItem("feedflow-invoice-show-logo") !== "false";
};

const DEFAULT_PRODUCT_CONFIG: ProductConfig = {
  units: [
    { id: "ton", labelAr: "طن", labelEn: "Ton", isBase: true },
    { id: "kg", labelAr: "كجم", labelEn: "Kg", conversionToBase: 1000 },
    { id: "bag", labelAr: "شيكارة", labelEn: "Bag", conversionToBase: 20 },
    { id: "piece", labelAr: "قطعة", labelEn: "Piece" },
    { id: "pair", labelAr: "زوج", labelEn: "Pair" },
    { id: "dozen", labelAr: "درزن", labelEn: "Dozen" },
    { id: "meter", labelAr: "متر", labelEn: "Meter" },
    { id: "liter", labelAr: "لتر", labelEn: "Liter" },
  ],
  defaultUnit: "ton",
  showPackageWeight: true,
  showPackageCount: true,
  packageWeightLabelAr: "وزن الشيكارة",
  packageWeightLabelEn: "Bag Weight",
  packageCountLabelAr: "عدد الشكاير",
  packageCountLabelEn: "Bag Count",
  packageWeightPresets: [25, 50, 100],
  customFields: [],
};

const getInitialProductConfig = (): ProductConfig => {
  try {
    const saved = localStorage.getItem("feedflow-product-config");
    if (saved) return JSON.parse(saved);
  } catch {}
  localStorage.setItem("feedflow-product-config", JSON.stringify(DEFAULT_PRODUCT_CONFIG));
  return DEFAULT_PRODUCT_CONFIG;
};

const getInitialLoggedInSubAccountId = (): string | null => {
  return localStorage.getItem("feedflow-logged-in-sub-account") || null;
};

const DEFAULT_SECURITY_QA = {
  q1: "من مؤسس النظام؟", a1: "يوسف مجر",
  q2: "تم إنشاء النظام لمن؟", a2: "مؤسسة النجوم للاعلاف",
  q3: "مين رقم 1؟", a3: "المعلم مصطفى عوض",
};

const getInitialSecurityQuestions = () => {
  try {
    const saved = localStorage.getItem("feedflow-security-qas");
    if (saved) return JSON.parse(saved);
  } catch {}
  localStorage.setItem("feedflow-security-qas", JSON.stringify(DEFAULT_SECURITY_QA));
  return DEFAULT_SECURITY_QA;
};

const applyLang = (lang: Language) => {
  document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", lang);
};

const applyTheme = (theme: Theme) => {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

applyLang(getInitialLang());
applyTheme(getInitialTheme());

export const useAppStore = create<AppState>((set, get) => ({
  language: getInitialLang(),
  theme: getInitialTheme(),
  setLanguage: (lang) => {
    localStorage.setItem("feedflow-lang", lang);
    applyLang(lang);
    set({ language: lang });
  },
  setTheme: (theme) => {
    localStorage.setItem("feedflow-theme", theme);
    applyTheme(theme);
    set({ theme });
  },
  t: (ar, en) => {
    return get().language === "ar" ? ar : en;
  },
  sidebarOrder: getInitialSidebarOrder(),
  setSidebarOrder: (order) => {
    localStorage.setItem("feedflow-sidebar-order", JSON.stringify(order));
    set({ sidebarOrder: order });
  },
  activeModules: getInitialActiveModules(),
  setActiveModules: (modules) => {
    localStorage.setItem("feedflow-active-modules", JSON.stringify(modules));
    set({ activeModules: modules });
  },
  toggleModule: (path) => {
    const current = get().activeModules;
    const updated = current.includes(path)
      ? current.filter(p => p !== path)
      : [...current, path];
    localStorage.setItem("feedflow-active-modules", JSON.stringify(updated));
    set({ activeModules: updated });
  },
  loggedInSubAccountId: getInitialLoggedInSubAccountId(),
  login: async (email = "", password = "") => {
    try {
      const result = await api.auth.login(email, password);
      if (result?.token) {
        localStorage.setItem("feedflow-jwt", result.token);
        localStorage.setItem("feedflow-logged-in-sub-account", result.user.id);
        set({ loggedInSubAccountId: result.user.id });
        logActivity("auth", "login", `تسجيل دخول: ${email}`, `Login: ${email}`);
        return true;
      }
    } catch {}
    // Fallback: check local accounts when API is unavailable
    const accts = getInitialSubAccounts();
    const match = accts.find(a => a.email === email && a.password === password);
    if (match) {
      localStorage.setItem("feedflow-jwt", "local-bypass");
      localStorage.setItem("feedflow-logged-in-sub-account", match.id);
      set({ loggedInSubAccountId: match.id });
      logActivity("auth", "login", `تسجيل دخول: ${email}`, `Login: ${email}`);
      return true;
    }
    // Admin master-password fallback
    if (email === "admin@factory.com") {
      const master = localStorage.getItem("feedflow-master-password");
      if (master && password === master) {
        localStorage.setItem("feedflow-jwt", "local-bypass");
        localStorage.setItem("feedflow-logged-in-sub-account", "admin");
        set({ loggedInSubAccountId: "admin" });
        logActivity("auth", "login", `تسجيل دخول: ${email}`, `Login: ${email}`);
        return true;
      }
    }
    return false;
  },
  logout: () => {
    localStorage.removeItem("feedflow-jwt");
    localStorage.removeItem("feedflow-logged-in-sub-account");
    api.auth.logout();
    set({ loggedInSubAccountId: null });
    logActivity("auth", "logout", `تسجيل خروج`, `Logout`);
  },
  hasFeaturePermission: (featureId) => {
    const id = get().loggedInSubAccountId;
    if (!id || id === "admin") return true;
    const account = get().subAccounts.find(a => a.id === id);
    if (!account) return true;
    return account.featurePermissions?.[featureId] ?? true;
  },
  subAccounts: getInitialSubAccounts(),
  addSubAccount: (account) => {
    const newAccount: SubAccount = {
      ...account,
      featurePermissions: account.featurePermissions || {},
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const updated = [...state.subAccounts, newAccount];
      localStorage.setItem("feedflow-sub-accounts", JSON.stringify(updated));
      logActivity("sub-accounts", "create", `إضافة حساب فرعي: ${newAccount.name}`, `Add sub-account: ${newAccount.name}`);
      return { subAccounts: updated };
    });
  },
  updateSubAccount: (id, updates) => {
    set((state) => {
      const updated = state.subAccounts.map(a => a.id === id ? { ...a, ...updates } : a);
      localStorage.setItem("feedflow-sub-accounts", JSON.stringify(updated));
      logActivity("sub-accounts", "update", `تحديث بيانات الحساب الفرعي`, `Update sub-account`);
      return { subAccounts: updated };
    });
  },
  deleteSubAccount: (id) => {
    set((state) => {
      const updated = state.subAccounts.filter(a => a.id !== id);
      localStorage.setItem("feedflow-sub-accounts", JSON.stringify(updated));
      logActivity("sub-accounts", "delete", `حذف الحساب الفرعي`, `Delete sub-account`);
      return { subAccounts: updated };
    });
  },
  // Discount settings
  maxDiscountPercent: getInitialMaxDiscount(),
  discountExceedAllowed: getInitialDiscountExceed(),
  setMaxDiscountPercent: (val) => {
    localStorage.setItem("feedflow-max-discount", String(val));
    set({ maxDiscountPercent: val });
  },
  setDiscountExceedAllowed: (val) => {
    localStorage.setItem("feedflow-discount-exceed", val ? "true" : "false");
    set({ discountExceedAllowed: val });
  },
  // Tax settings
  taxEnabled: getInitialTaxEnabled(),
  taxPercent: getInitialTaxPercent(),
  setTaxEnabled: (val) => {
    localStorage.setItem("feedflow-tax-enabled", val ? "true" : "false");
    set({ taxEnabled: val });
  },
  setTaxPercent: (val) => {
    localStorage.setItem("feedflow-tax-percent", String(val));
    set({ taxPercent: val });
  },
  // Overdue invoice settings
  overdueEnabled: getInitialOverdueEnabled(),
  overdueDays: getInitialOverdueDays(),
  overdueMonths: getInitialOverdueMonths(),
  overdueAlerts: [],
  setOverdueEnabled: (val) => {
    localStorage.setItem("feedflow-overdue-enabled", val ? "true" : "false");
    set({ overdueEnabled: val });
  },
  setOverdueDays: (val) => {
    localStorage.setItem("feedflow-overdue-days", String(val));
    set({ overdueDays: val });
  },
  setOverdueMonths: (val) => {
    localStorage.setItem("feedflow-overdue-months", String(val));
    set({ overdueMonths: val });
  },
  setOverdueAlerts: (alerts) => set({ overdueAlerts: alerts }),
  dismissOverdueAlert: (invoiceId) => set(s => ({
    overdueAlerts: s.overdueAlerts.filter(a => a.invoiceId !== invoiceId),
  })),
  // Global substitution alerts
  substitutionAlerts: [],
  substitutionDialogOpen: false,
  substitutionDialogData: null,
  substitutionLoading: false,
  onApproveSubstitution: null,
  onRejectSubstitution: null,
  setSubstitutionAlerts: (alerts) => set({ substitutionAlerts: alerts }),
  openSubstitutionDialog: (data) => set({ substitutionDialogOpen: true, substitutionDialogData: data }),
  closeSubstitutionDialog: () => set({ substitutionDialogOpen: false, substitutionDialogData: null }),
  setSubstitutionLoading: (loading) => set({ substitutionLoading: loading }),
  registerSubstitutionHandlers: (approve, reject) => set({
    onApproveSubstitution: approve,
    onRejectSubstitution: reject,
  }),
  // Bank accounts & payment methods
  bankAccounts: (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("feedflow-banks") || "[]") || [];
      return raw.map((a: any) => ({ ...a, balance: Number(a.balance) }));
    } catch { return []; }
  })(),
  paymentMethods: [
    { id: "cash", labelAr: "نقدي", labelEn: "Cash" },
    { id: "bank_transfer", labelAr: "تحويل بنكي", labelEn: "Bank Transfer" },
    { id: "vodafone_cash", labelAr: "فودافون كاش", labelEn: "Vodafone Cash" },
    { id: "instapay", labelAr: "انستا باي", labelEn: "InstaPay" },
  ],
  addBankAccount: (account) => set(s => {
    const updated = [...s.bankAccounts, { id: `bank-${Date.now()}`, ...account, balance: Number(account.balance) }];
    localStorage.setItem("feedflow-banks", JSON.stringify(updated));
    logActivity("accounting", "create", `إضافة بنك: ${account.name}`, `Add bank: ${account.name}`);
    return { bankAccounts: updated };
  }),
  updateBankAccount: (id, updates) => set(s => {
    const updated = s.bankAccounts.map(a => a.id === id ? { ...a, ...updates } : a);
    localStorage.setItem("feedflow-banks", JSON.stringify(updated));
    logActivity("accounting", "update", `تحديث بيانات البنك`, `Update bank`);
    return { bankAccounts: updated };
  }),
  updateBankBalance: (id, delta) => set(s => {
    const updated = s.bankAccounts.map(a => a.id === id ? { ...a, balance: Number(a.balance) + Number(delta) } : a);
    localStorage.setItem("feedflow-banks", JSON.stringify(updated));
    if (delta !== 0) logActivity("accounting", "update", `تعديل رصيد البنك: ${delta > 0 ? "+" : ""}${delta}`, `Update bank balance: ${delta > 0 ? "+" : ""}${delta}`);
    return { bankAccounts: updated };
  }),
  deleteBankAccount: (id) => set(s => {
    const updated = s.bankAccounts.filter(a => a.id !== id);
    localStorage.setItem("feedflow-banks", JSON.stringify(updated));
    logActivity("accounting", "delete", `حذف البنك`, `Delete bank`);
    return { bankAccounts: updated };
  }),
  // Wallet accounts
  walletAccounts: (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("feedflow-wallets") || "[]") || [];
      return raw.map((w: any) => ({ ...w, balance: Number(w.balance) }));
    } catch { return []; }
  })(),
  addWalletAccount: (wallet) => set(s => {
    const updated = [...s.walletAccounts, { id: `wallet-${Date.now()}`, ...wallet, balance: Number(wallet.balance) }];
    localStorage.setItem("feedflow-wallets", JSON.stringify(updated));
    logActivity("accounting", "create", `إضافة محفظة: ${wallet.name}`, `Add wallet: ${wallet.name}`);
    return { walletAccounts: updated };
  }),
  updateWalletAccount: (id, updates) => set(s => {
    const updated = s.walletAccounts.map(a => a.id === id ? { ...a, ...updates } : a);
    localStorage.setItem("feedflow-wallets", JSON.stringify(updated));
    logActivity("accounting", "update", `تحديث بيانات المحفظة`, `Update wallet`);
    return { walletAccounts: updated };
  }),
  updateWalletBalance: (id, delta) => set(s => {
    const updated = s.walletAccounts.map(a => a.id === id ? { ...a, balance: Number(a.balance) + Number(delta) } : a);
    localStorage.setItem("feedflow-wallets", JSON.stringify(updated));
    if (delta !== 0) logActivity("accounting", "update", `تعديل رصيد المحفظة: ${delta > 0 ? "+" : ""}${delta}`, `Update wallet balance: ${delta > 0 ? "+" : ""}${delta}`);
    return { walletAccounts: updated };
  }),
  deleteWalletAccount: (id) => set(s => {
    const updated = s.walletAccounts.filter(a => a.id !== id);
    localStorage.setItem("feedflow-wallets", JSON.stringify(updated));
    logActivity("accounting", "delete", `حذف المحفظة`, `Delete wallet`);
    return { walletAccounts: updated };
  }),
  // Expense categories
  expenseCategories: (() => {
    try {
      const saved = localStorage.getItem("feedflow-expense-categories");
      if (saved) return JSON.parse(saved);
    } catch {}
    return ["شراء خامات", "رواتب", "صيانة", "مصروفات تشغيل", "إيداع بنكي"];
  })(),
  addExpenseCategory: (name) => set(s => {
    if (s.expenseCategories.includes(name)) return s;
    const updated = [...s.expenseCategories, name];
    localStorage.setItem("feedflow-expense-categories", JSON.stringify(updated));
    logActivity("accounting", "create", `إضافة تصنيف مصروفات: ${name}`, `Add expense category: ${name}`);
    return { expenseCategories: updated };
  }),
  deleteExpenseCategory: (name) => set(s => {
    const updated = s.expenseCategories.filter(c => c !== name);
    localStorage.setItem("feedflow-expense-categories", JSON.stringify(updated));
    logActivity("accounting", "delete", `حذف تصنيف المصروفات`, `Delete expense category`);
    return { expenseCategories: updated };
  }),
  // Payroll settings
  payrollMonthlyReleaseDay: (() => {
    const saved = localStorage.getItem("feedflow-payroll-monthly-release");
    return saved ? parseInt(saved) : 30;
  })(),
  payrollMonthlyAdvanceDays: (() => {
    const saved = localStorage.getItem("feedflow-payroll-monthly-advance");
    return saved ? parseInt(saved) : 2;
  })(),
  payrollWeeklyReleaseDay: (() => {
    const saved = localStorage.getItem("feedflow-payroll-weekly-release");
    return saved ? parseInt(saved) : 4; // Thursday (0=Sun)
  })(),
  payrollWeeklyAdvanceDays: (() => {
    const saved = localStorage.getItem("feedflow-payroll-weekly-advance");
    return saved ? parseInt(saved) : 1;
  })(),
  payrollWeekStartDay: (() => {
    const saved = localStorage.getItem("feedflow-payroll-week-start");
    return saved ? parseInt(saved) : 6; // default Saturday
  })(),
  payrollMonthStartDay: (() => {
    const saved = localStorage.getItem("feedflow-payroll-month-start");
    return saved ? parseInt(saved) : 1; // default day 1
  })(),
  setPayrollMonthlyReleaseDay: (val) => {
    localStorage.setItem("feedflow-payroll-monthly-release", String(val));
    set({ payrollMonthlyReleaseDay: val });
  },
  setPayrollMonthlyAdvanceDays: (val) => {
    localStorage.setItem("feedflow-payroll-monthly-advance", String(val));
    set({ payrollMonthlyAdvanceDays: val });
  },
  setPayrollWeeklyReleaseDay: (val) => {
    localStorage.setItem("feedflow-payroll-weekly-release", String(val));
    set({ payrollWeeklyReleaseDay: val });
  },
  setPayrollWeeklyAdvanceDays: (val) => {
    localStorage.setItem("feedflow-payroll-weekly-advance", String(val));
    set({ payrollWeeklyAdvanceDays: val });
  },
  setPayrollWeekStartDay: (val) => {
    localStorage.setItem("feedflow-payroll-week-start", String(val));
    set({ payrollWeekStartDay: val });
  },
  setPayrollMonthStartDay: (val) => {
    localStorage.setItem("feedflow-payroll-month-start", String(val));
    set({ payrollMonthStartDay: val });
  },
  // Company info
  companyName: getInitialCompanyName(),
  companyAddress: getInitialCompanyAddress(),
  companyLogo: getInitialCompanyLogo(),
  setCompanyName: (val) => {
    localStorage.setItem("feedflow-company-name", val);
    set({ companyName: val });
  },
  setCompanyAddress: (val) => {
    localStorage.setItem("feedflow-company-address", val);
    set({ companyAddress: val });
  },
  setCompanyLogo: (val) => {
    localStorage.setItem("feedflow-company-logo", val);
    set({ companyLogo: val });
  },
  // Print settings (reports)
  printPaperSize: getInitialPrintPaperSize(),
  printOrientation: getInitialPrintOrientation(),
  printFontSize: getInitialPrintFontSize(),
  printShowLogo: getInitialPrintShowLogo(),
  setPrintPaperSize: (val) => {
    localStorage.setItem("feedflow-print-paper-size", val);
    set({ printPaperSize: val });
  },
  setPrintOrientation: (val) => {
    localStorage.setItem("feedflow-print-orientation", val);
    set({ printOrientation: val });
  },
  setPrintFontSize: (val) => {
    localStorage.setItem("feedflow-print-font-size", String(val));
    set({ printFontSize: val });
  },
  setPrintShowLogo: (val) => {
    localStorage.setItem("feedflow-print-show-logo", val ? "true" : "false");
    set({ printShowLogo: val });
  },
  // Invoice print settings
  invoicePaperSize: getInitialInvoicePaperSize(),
  invoiceOrientation: getInitialInvoiceOrientation(),
  invoiceFontSize: getInitialInvoiceFontSize(),
  invoiceShowLogo: getInitialInvoiceShowLogo(),
  setInvoicePaperSize: (val) => {
    localStorage.setItem("feedflow-invoice-paper-size", val);
    set({ invoicePaperSize: val });
  },
  setInvoiceOrientation: (val) => {
    localStorage.setItem("feedflow-invoice-orientation", val);
    set({ invoiceOrientation: val });
  },
  setInvoiceFontSize: (val) => {
    localStorage.setItem("feedflow-invoice-font-size", String(val));
    set({ invoiceFontSize: val });
  },
  setInvoiceShowLogo: (val) => {
    localStorage.setItem("feedflow-invoice-show-logo", val ? "true" : "false");
    set({ invoiceShowLogo: val });
  },

  // Invoice features
  showSpellChecker: (() => localStorage.getItem("feedflow-show-spell-checker") === "true")(),
  simpleInvoiceItems: (() => localStorage.getItem("feedflow-simple-invoice-items") === "true")(),
  setShowSpellChecker: (val) => {
    localStorage.setItem("feedflow-show-spell-checker", val ? "true" : "false");
    set({ showSpellChecker: val });
  },
  setSimpleInvoiceItems: (val) => {
    localStorage.setItem("feedflow-simple-invoice-items", val ? "true" : "false");
    set({ simpleInvoiceItems: val });
  },

  /* ── Product Config ── */
  productConfig: getInitialProductConfig(),
  setProductConfig: (config) => {
    localStorage.setItem("feedflow-product-config", JSON.stringify(config));
    set({ productConfig: config });
  },

  /* ── Security Questions ── */
  securityQuestions: getInitialSecurityQuestions(),
  updateSecurityAnswers: (q1, a1, q2, a2, q3, a3) => {
    const qas = { q1, a1: a1.trim().toLowerCase(), q2, a2: a2.trim().toLowerCase(), q3, a3: a3.trim().toLowerCase() };
    localStorage.setItem("feedflow-security-qas", JSON.stringify(qas));
    set({ securityQuestions: qas });
    logActivity("settings", "update", `تحديث أسئلة الأمان`, `Update security questions`);
  },
  verifySecurityAnswer: (num: 1|2|3, answer: string): boolean => {
    const qas = get().securityQuestions;
    if (!qas) return false;
    const key = `a${num}` as "a1"|"a2"|"a3";
    return qas[key] === answer.trim().toLowerCase();
  },
  resetPasswordWithSecurity: (newPassword: string) => {
    localStorage.setItem("feedflow-master-password", newPassword);
    const accts = getInitialSubAccounts();
    const updated = accts.map(a => ({ ...a, password: newPassword }));
    localStorage.setItem("feedflow-sub-accounts", JSON.stringify(updated));
    set({ subAccounts: updated });
    logActivity("auth", "update", `إعادة تعيين كلمة المرور عبر أسئلة الأمان`, `Password reset via security questions`);
  },
}));

export { ALL_MODULE_PATHS, DEFAULT_SIDEBAR_ORDER };
