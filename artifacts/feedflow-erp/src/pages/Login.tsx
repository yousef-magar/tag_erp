import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useAppStore } from "@/hooks/use-app-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Crown, Lock, Mail, Globe, Moon, Sun, ArrowRight, AlertCircle, UserPlus, ShieldQuestion, CheckCircle2, KeyRound } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { t, language, setLanguage, theme, setTheme, login, securityQuestions, verifySecurityAnswer, resetPasswordWithSecurity, subAccounts, updateSubAccount } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState<"init"|"questions"|"reset"|"done">("init");
  const [qNum, setQNum] = useState<1|2|3>(1);
  const [qAnswer, setQAnswer] = useState("");
  const [qError, setQError] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwdConfirm, setNewPwdConfirm] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const success = await login(email, password);
    if (success) {
      setLocation("/");
    } else {
      setError(t("البريد الإلكتروني أو كلمة المرور غير صحيحة", "Invalid email or password"));
      setLoading(false);
    }
  };

  const forgotAccount = subAccounts.find(a => a.email === email && email);
  const hasSecurityQuestions = forgotAccount?.securityQuestions?.q1 && forgotAccount?.securityQuestions?.a1;

  const questionLabels: Record<1|2|3, {q: string; key: string}> = hasSecurityQuestions
    ? {
        1: { q: forgotAccount!.securityQuestions!.q1, key: "a1" },
        2: { q: forgotAccount!.securityQuestions!.q2, key: "a2" },
        3: { q: forgotAccount!.securityQuestions!.q3, key: "a3" },
      }
    : {
        1: { q: securityQuestions?.q1 || "من مؤسس النظام؟", key: "a1" },
        2: { q: securityQuestions?.q2 || "تم إنشاء النظام لمن؟", key: "a2" },
        3: { q: securityQuestions?.q3 || "مين رقم 1؟", key: "a3" },
      };

  const handleAnswer = () => {
    if (!qAnswer.trim()) { setQError(t("يرجى إدخال الإجابة", "Please enter the answer")); return; }
    setQError("");
    const normalized = qAnswer.trim().toLowerCase();
    let correct = false;
    if (hasSecurityQuestions) {
      const sq = forgotAccount!.securityQuestions!;
      const map = { 1: sq.a1, 2: sq.a2, 3: sq.a3 };
      correct = normalized === map[qNum].trim().toLowerCase();
    } else {
      correct = verifySecurityAnswer(qNum, qAnswer);
    }
    if (!correct) { setQError(t("الإجابة غير صحيحة", "Incorrect answer")); return; }
    if (qNum < 3) {
      setQNum((qNum + 1) as 1|2|3);
      setQAnswer("");
    } else {
      setForgotMode("reset");
    }
  };

  const handleResetPassword = () => {
    if (!newPwd || newPwd.length < 4) { setQError(t("كلمة المرور قصيرة جداً", "Password is too short")); return; }
    if (newPwd !== newPwdConfirm) { setQError(t("كلمة المرور غير متطابقة", "Passwords don't match")); return; }
    setQError("");
    if (hasSecurityQuestions && forgotAccount) {
      updateSubAccount(forgotAccount.id, { password: newPwd });
    } else {
      resetPasswordWithSecurity(newPwd);
    }
    setForgotMode("done");
  };

  if (forgotMode === "done") {
    return (
      <div className="min-h-svh w-full flex items-center justify-center bg-background p-8">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t("تم إعادة تعيين كلمة السر", "Password Reset")}</h2>
          <p className="text-muted-foreground mb-8">{t("يمكنك الآن تسجيل الدخول بكلمة السر الجديدة", "You can now sign in with your new password")}</p>
          <Button onClick={() => { setForgotMode("init"); setQNum(1); setQAnswer(""); setNewPwd(""); setNewPwdConfirm(""); }}>
            {t("تسجيل الدخول", "Sign In")} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-svh w-full flex flex-col md:flex-row bg-background">
      <div className="w-full md:w-1/2 flex flex-col justify-center px-4 sm:px-8 md:px-12 lg:px-20 xl:px-28 relative z-10 py-6 sm:py-0">
        
        <div className="flex justify-between items-center mb-4 sm:mb-8 md:absolute md:top-6 md:left-6 md:right-6">
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center my-20"
        >
          {forgotMode === "init" ? (
            <>
              <div className="mb-6 md:mb-10">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2 md:mb-3">{t("مرحباً بك مجدداً", "Welcome Back")}</h1>
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
                  {t("سجل دخولك للوصول إلى لوحة التحكم", "Sign in to access your dashboard")}
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4 md:space-y-5">
                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="email" className="text-sm md:text-base">{t("البريد الإلكتروني", "Email Address")}</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@factory.com" className="pr-9 sm:pr-10 h-10 sm:h-12 text-sm sm:text-base" />
                  </div>
                </div>

                <div className="space-y-1.5 md:space-y-2">
                  <Label htmlFor="password" className="text-sm md:text-base">{t("كلمة المرور", "Password")}</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pr-9 sm:pr-10 h-10 sm:h-12 text-sm sm:text-base" />
                  </div>
                </div>

                <div className="text-left rtl:text-right">
                  <button type="button" onClick={() => setForgotMode("questions")} className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2">
                    {t("نسيت كلمة السر؟", "Forgot password?")}
                  </button>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm">
                    <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <Button type="submit" className="w-full h-10 sm:h-12 text-sm sm:text-base font-semibold group relative overflow-hidden" disabled={loading}>
                  <span className={`transition-opacity ${loading ? "opacity-0" : "opacity-100"} flex items-center gap-2`}>
                    {t("تسجيل الدخول", "Sign In")}
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                  </span>
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                    </div>
                  )}
                </Button>
              </form>

              <div className="mt-6 md:mt-8 pt-5 md:pt-6 border-t border-border/50 text-center">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 md:mb-3">
                  {t("ليس لديك حساب؟", "Don't have an account?")}
                </p>
                <Link href="/signup" className="inline-flex items-center gap-1.5 sm:gap-2 text-primary hover:underline font-medium text-xs sm:text-sm">
                  <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t("إنشاء حساب مدير", "Create Admin Account")}
                </Link>
              </div>
            </>
          ) : forgotMode === "questions" ? (
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ShieldQuestion className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">{t("أسئلة الأمان", "Security Questions")}</h2>
                    <p className="text-xs text-muted-foreground">{t(`السؤال ${qNum} من 3`, `Question ${qNum} of 3`)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold bg-muted/50 p-3 rounded-lg border border-border/50">
                  {questionLabels[qNum].q}
                </p>

                <div className="space-y-1.5">
                  <Label className="text-sm">{t("الإجابة", "Answer")}</Label>
                  <Input value={qAnswer} onChange={e => setQAnswer(e.target.value)} placeholder={t("اكتب إجابتك", "Type your answer")} onKeyDown={e => { if (e.key === "Enter") handleAnswer(); }} />
                </div>

                {qError && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{qError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button className="flex-1" onClick={handleAnswer}>
                    {qNum < 3 ? t("التالي", "Next") : t("تحقق", "Verify")}
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </Button>
                  <Button variant="outline" onClick={() => { setForgotMode("init"); setQNum(1); setQAnswer(""); setQError(""); }}>
                    {t("رجوع", "Back")}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">{t("إعادة تعيين كلمة السر", "Reset Password")}</h2>
                    <p className="text-xs text-muted-foreground">{t("أدخل كلمة السر الجديدة", "Enter your new password")}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("كلمة السر الجديدة", "New Password")}</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" className="pr-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("تأكيد كلمة السر", "Confirm Password")}</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" value={newPwdConfirm} onChange={e => setNewPwdConfirm(e.target.value)} placeholder="••••••••" className="pr-9" />
                  </div>
                </div>

                {qError && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{qError}</span>
                  </div>
                )}

                <Button className="w-full" onClick={handleResetPassword}>
                  <CheckCircle2 className="w-4 h-4" />
                  {t("حفظ كلمة السر الجديدة", "Save New Password")}
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      <div className="hidden md:flex w-1/2 bg-sidebar relative overflow-hidden items-center justify-center p-8 lg:p-12">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-chart-2/20 blur-[120px]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10 text-center max-w-md lg:max-w-lg"
        >
          <div className="w-20 h-20 lg:w-24 lg:h-24 mx-auto bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-6 lg:mb-8 shadow-xl shadow-primary/20">
            <Crown className="w-10 h-10 lg:w-12 lg:h-12" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3 lg:mb-4 text-foreground">
            {t("تاج", "Tag")}
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
            {t(
              "نظام إدارة متكامل — الأذكى والأكثر تطوراً. تحكم كامل، دقة متناهية، وقرارات مدعومة بالذكاء الاصطناعي.",
              "The smartest and most advanced integrated ERP system. Full control, ultimate precision, and AI-powered decisions."
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
