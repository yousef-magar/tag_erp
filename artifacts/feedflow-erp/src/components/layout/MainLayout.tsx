import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import gsap from "gsap";
import { ParticleField } from "@/components/ui/ParticleField";
import { MeshGradient } from "@/components/ui/MeshGradient";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/hooks/use-app-store";
import { SyncEngine } from "@/components/SyncEngine";
import ShortcutsHelpDialog from "@/components/ShortcutsHelpDialog";

const pageTransition = {
  initial: { opacity: 0, y: 24, scale: 0.97, filter: "blur(6px)" },
  animate: {
    opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as any },
  },
  exit: {
    opacity: 0, y: -12, scale: 0.98, filter: "blur(3px)",
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as any },
  },
};

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const companyLogo = useAppStore(s => s.companyLogo);
  const companyName = useAppStore(s => s.companyName);

  const { helpOpen, setHelpOpen, shortcuts, toggleHelp } = useKeyboardShortcuts(globalSearchOpen, setGlobalSearchOpen);

  useEffect(() => {
    if (!mainRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(mainRef.current, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" });
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!contentRef.current) return;
    const cards = contentRef.current.querySelectorAll(".stat-card");
    if (!cards.length) return;
    gsap.fromTo(cards, { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.06, duration: 0.5, ease: "power3.out" });
  }, [location]);

  // Mobile layout — bottom nav + full-screen content
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
        <header className="h-12 border-b border-border bg-card/95 backdrop-blur-sm flex items-center justify-between px-3 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-sm font-bold overflow-hidden shadow-sm shrink-0">
              {companyLogo ? <img src={companyLogo} alt="logo" className="w-full h-full object-contain" /> : "F"}
            </div>
            <span className="text-sm font-semibold truncate max-w-28">{companyName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleHelp} className="p-2 rounded-lg hover:bg-muted/50 transition-colors" title="Keyboard shortcuts">
              <span className="text-sm font-bold text-muted-foreground">?</span>
            </button>
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </header>
        <main ref={mainRef} className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/20 relative pb-16">
          <div className="px-3 py-4">
            {children}
          </div>
        </main>
        <MobileNav />
        <GlobalSearch open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
        <ShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} shortcuts={shortcuts} />
        <SyncEngine />
      </div>
    );
  }

  // Desktop layout — sidebar + header + content
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
      <MeshGradient speed={0.5} />
      <ParticleField count={20} interactive colors={["hsl(var(--primary)/0.08)", "hsl(var(--chart-2)/0.06)"]} />
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div
        className="flex-1 flex flex-col h-full relative z-10"
        style={{ paddingInlineStart: collapsed ? "80px" : "280px" }}
      >
        <Header onToggleHelp={toggleHelp} />
        <main ref={mainRef} className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/20 p-6 relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px]" />
          </div>
          <div ref={contentRef} className="relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                variants={pageTransition}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <GlobalSearch open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
        <ShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} shortcuts={shortcuts} />
        <SyncEngine />
      </div>
    </div>
  );
}
