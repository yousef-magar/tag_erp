import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { useAppStore } from "@/hooks/use-app-store";
import { isAutoBackupEnabled, setAutoBackupEnabled, runAutoBackupIfNeeded, startAutoBackupTimer } from "@/lib/database";
import { migrateFromLocalStorage } from "@/lib/dexie-storage";
import { MainLayout } from "@/components/layout/MainLayout";
import { OverdueChecker } from "@/components/OverdueChecker";
import { NotificationChecker } from "@/components/NotificationChecker";
import { AppInitializer } from "@/components/AppInitializer";
import { DynamicMeta } from "@/components/DynamicMeta";
import { PwaInstall } from "@/components/PwaInstall";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import Inventory from "@/pages/Inventory";
import Customers from "@/pages/Customers";
import Sales from "@/pages/Sales";
import Production from "@/pages/Production";
import AiAssistant from "@/pages/AiAssistant";
import Fleet from "@/pages/Fleet";
import HR from "@/pages/HR";
import Payroll from "@/pages/Payroll";
import Attendance from "@/pages/Attendance";
import Marketing from "@/pages/Marketing";
import Accounting from "@/pages/Accounting";
import Procurement from "@/pages/Procurement";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import SubAccounts from "@/pages/SubAccounts";
import Pricing from "@/pages/Pricing";
import ActivityLog from "@/pages/ActivityLog";
import Profit from "@/pages/Profit";

const queryClient = new QueryClient();

function Router() {
  const loggedIn = !!useAppStore(s => s.loggedInSubAccountId);

  if (!loggedIn) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={SignUp} />
        <Route path="*">
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        <Redirect to="/" />
      </Route>
      <Route path="/signup" component={SignUp} />
      <Route path="*">
        <MainLayout>
          <OverdueChecker />
          <NotificationChecker />
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/production" component={Production} />
            <Route path="/inventory" component={Inventory} />
            <Route path="/sales" component={Sales} />
            <Route path="/customers" component={Customers} />
            <Route path="/ai-assistant" component={AiAssistant} />
            <Route path="/fleet" component={Fleet} />
            <Route path="/hr" component={HR} />
            <Route path="/attendance" component={Attendance} />
            <Route path="/payroll" component={Payroll} />
            <Route path="/marketing" component={Marketing} />
            <Route path="/accounting" component={Accounting} />
            <Route path="/procurement" component={Procurement} />
            <Route path="/reports" component={Reports} />
            <Route path="/sub-accounts" component={SubAccounts} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/profit" component={Profit} />
            <Route path="/activity-log" component={ActivityLog} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </MainLayout>
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    migrateFromLocalStorage(["ff-sales", "ff-hr-store", "ff-fleet", "ff-procurement", "ff-pricing-store-v3", "ff-activity-log"]);
    if (!isAutoBackupEnabled()) setAutoBackupEnabled(true);
    runAutoBackupIfNeeded();
    startAutoBackupTimer();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppInitializer>
          <DynamicMeta />
          <PwaInstall />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AppInitializer>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
