import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useAppStore } from "@/hooks/use-app-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Crown, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Globe, Moon, Sun, ShieldQuestion, KeyRound } from "lucide-react";

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { t, language, setLanguage, theme, setTheme, addSubAccount, updateSecurityAnswers } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [q1, setQ1] = useState("من مؤسس النظام؟");
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState("تم إنشاء النظام لمن؟");
  const [a2, setA2] = useState("");
  const [q3, setQ3] = useState("مين رقم 1؟");
  const [a3, setA3] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError(t("يرجى ملء جميع الحقول", "Please fill all fields"));
      return;
    }
    if (!a1.trim() || !a2.trim() || !a3.trim()) {
      setError(t("يرجى الإجابة على أسئلة الأمان", "Please answer the security questions"));
      return;
    }
    setLoading(true);
    setTimeout(() => {
      addSubAccount({
        name: name.trim(),
        email: email.trim(),
        password,
        role: "admin",
        active: true,
        permissions: {},
        canExceedDiscountLimit: true,
        canAccessPricing: true,
        canAccessHR: true,
        canAccessPayroll: true,
        featurePermissions: {},
      });
      updateSecurityAnswers(q1, a1, q2, a2, q3, a3);
      localStorage.setItem("feedflow-master-password", password);
      setDone(true);
      setLoading(false);
    }, 600);
  };

  if (done) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-8">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t("تم إنشاء الحساب", "Account Created")}</h2>
          <p className="text-muted-foreground mb-8">{t("يمكنك الآن تسجيل الدخول", "You can now sign in")}</p>
          <Link href="/login" className="inline-flex items-center gap-2 text-primary hover:underline font-medium">
            {t("تسجيل الدخول", "Sign In")} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-svh w-full flex flex-col md:flex-row bg-background">
      <div className="w-full md:w-1/2 flex flex-col justify-center px-4 sm:px-8 md:px-12 lg:px-20 xl:px-28 relative z-10 py-6 sm:py-0 overflow-y-auto max-h-svh">
        <div className="flex justify-between items-center mb-4 sm:mb-6 md:absolute md:top-6 md:left-6 md:right-6">
          <div className="flex items-center gap-2 text-primary font-bold text-lg sm:text-xl md:hidden">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-primary text-primary-foreground flex items-center justify-center text-sm sm:text-base">F</div>
            تاج
          </div>
          <div className="flex items-center gap-3 sm:gap-4 mr-auto md:mr-0">
            <button onClick={() => setLanguage(language === "ar" ? "en" : "ar")} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {language === "ar" ? "English" : "عربي"}
            </button>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="text-muted-foreground hover:text-foreground transition-colors">
              {theme === "dark" ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center my-8">
          <div className="mb-4 md:mb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1 md:mb-2">{t("إنشاء حساب", "Create Account")}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">{t("أنشئ حساب المدير للبدء", "Create an admin account to get started")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="name" className="text-sm">{t("الاسم", "Full Name")}</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder={t("مدير النظام", "System Admin")} className="pr-9 h-10 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="email" className="text-sm">{t("البريد الإلكتروني", "Email Address")}</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@factory.com" className="pr-9 h-10 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="password" className="text-sm">{t("كلمة المرور", "Password")}</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pr-9 h-10 text-sm" />
              </div>
            </div>

            <div className="border-t border-border/50 pt-3 md:pt-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldQuestion className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{t("أسئلة الأمان", "Security Questions")}</span>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{t("السؤال الأول", "Question 1")}</Label>
                  <Input value={q1} onChange={e => setQ1(e.target.value)} className="h-9 text-xs mt-1 mb-1" />
                  <Input value={a1} onChange={e => setA1(e.target.value)} placeholder={t("الإجابة", "Answer")} className="h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("السؤال الثاني", "Question 2")}</Label>
                  <Input value={q2} onChange={e => setQ2(e.target.value)} className="h-9 text-xs mt-1 mb-1" />
                  <Input value={a2} onChange={e => setA2(e.target.value)} placeholder={t("الإجابة", "Answer")} className="h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("السؤال الثالث", "Question 3")}</Label>
                  <Input value={q3} onChange={e => setQ3(e.target.value)} className="h-9 text-xs mt-1 mb-1" />
                  <Input value={a3} onChange={e => setA3(e.target.value)} placeholder={t("الإجابة", "Answer")} className="h-9 text-xs" />
                </div>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {t("إنشاء الحساب", "Create Account")}
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center mt-6 text-xs text-muted-foreground">
            {t("لديك حساب بالفعل؟", "Already have an account?")}{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">{t("تسجيل الدخول", "Sign In")}</Link>
          </p>
        </motion.div>
      </div>

      <div className="hidden md:flex w-1/2 bg-sidebar relative overflow-hidden items-center justify-center p-8 lg:p-12">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-chart-2/20 blur-[120px]" />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative z-10 text-center max-w-md lg:max-w-lg">
          <div className="w-20 h-20 lg:w-24 lg:h-24 mx-auto bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-6 lg:mb-8 shadow-xl shadow-primary/20">
            <Crown className="w-10 h-10 lg:w-12 lg:h-12" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3 lg:mb-4 text-foreground">{t("تاج", "Tag")}</h2>
          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
            {t("أنشئ حساب المدير وابدأ رحلة الإدارة الذكية", "Create an admin account and start your smart management journey")}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
