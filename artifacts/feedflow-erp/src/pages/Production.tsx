import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import {
  useProductionStore, findInventoryMatch, resolveFormulaIngredients,
  type ProductionOrder as Order, type BagEntry, type WorkSession,
  type OrderStatus, type ResolvedIngredient,
} from "@/hooks/use-production-store";
import { mockData } from "@/lib/mock-data";
import { suggestSubstitutions, MATERIAL_CATALOG, findBestSubstitute, getMaterialPrice, type SubstitutionResult as SubResult } from "@/lib/substitution-engine";
import { usePricingStore } from "@/hooks/use-pricing-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SmartInput from "@/components/SmartInput";
import { getFeedTermSuggestions } from "@/lib/spellcheck";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Factory, CheckCircle2, Clock, Plus, FlaskConical, Trash2, Pencil,
  PlayCircle, StopCircle, History, Timer, Zap, Package, CalendarDays,
  X, TrendingUp, Layers, BarChart3, PackageCheck, Scale, ArrowLeftRight,
  AlertTriangle, Bell, Brain, ChevronDown, Store, Download,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { MagItem } from "@/components/ui/magnifier";
import { FormulasTab } from "./production/FormulasTab";
import { BagsBreakdownDialog } from "./production/BagsBreakdownDialog";

/* ─── Pure Helpers ─── */
const nowTime24 = () => { const n=new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; };
const nowDate   = () => new Date().toISOString().split("T")[0];
function to12h(t:string){if(!t||!t.includes(":"))return"--";const[h,m]=t.split(":").map(Number);return`${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"م":"ص"}`;}
function toMins(t:string){if(!t||!t.includes(":"))return 0;const[h,m]=t.split(":").map(Number);return h*60+m;}
function calcDurationMins(from:string,to:string){const d=toMins(to)-toMins(from);return d>=0?d:d+1440;}
function fmtMins(m:number){if(!m)return"0 د";const h=Math.floor(m/60),mn=m%60;return h>0?(mn>0?`${h}س ${mn}د`:`${h}س`):`${mn}د`;}
function fmtElapsed(s:number){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return h>0?`${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;}
function fmtDate(d:string){if(!d)return"";const p=d.split("T")[0].split("-");if(p.length!==3)return d;return`${p[2]}/${p[1]}/${p[0]}`;}
function fmtNum(n:number){return new Intl.NumberFormat("ar-EG").format(n);}

function calcUnionWorkMins(orders:Order[]):number{
  const now=nowTime24(),intervals:[number,number][]=[];
  for(const o of orders)for(const s of o.sessions){const st=toMins(s.startedAt),en=s.endedAt?toMins(s.endedAt):toMins(now),adj=en>=st?en:en+1440;if(adj>st)intervals.push([st,adj]);}
  if(!intervals.length)return 0;
  intervals.sort((a,b)=>a[0]-b[0]);
  const m:[number,number][]=[[...intervals[0]] as [number,number]];
  for(let i=1;i<intervals.length;i++){const last=m[m.length-1];if(intervals[i][0]<=last[1])last[1]=Math.max(last[1],intervals[i][1]);else m.push([...intervals[i]] as [number,number]);}
  return m.reduce((s,[a,b])=>s+(b-a),0);
}

const getProgress  = (o:Order)=>!o.targetTons?0:Math.min(100,Math.round(o.producedTons/o.targetTons*100));
const getCardWork  = (o:Order)=>o.sessions.reduce((s,x)=>s+(x.durationMins??0),0);
const getActive    = (o:Order)=>{const l=o.sessions[o.sessions.length-1];return l&&l.endedAt===null?l:null;};
const bagsTotalTons= (bags:BagEntry[])=>bags.reduce((s,b)=>s+(b.count*b.weightKg)/1000,0);
const bagsTotal    = (bags:BagEntry[])=>bags.reduce((s,b)=>s+b.count,0);

const PRESET_WEIGHTS=[25,50,100];

/* ─── Live Timer ─── */
function useLiveTimer(session:WorkSession|null,status:OrderStatus){
  const[secs,setSecs]=useState(0);
  useEffect(()=>{
    if(!session||status!=="in-progress"){setSecs(0);return;}
    const calc=()=>{const now=new Date(),[h,m]=session.startedAt.split(":").map(Number),s=new Date();s.setHours(h,m,0,0);setSecs(Math.max(0,Math.floor((now.getTime()-s.getTime())/1000)));};
    calc();const id=setInterval(calc,1000);return()=>clearInterval(id);
  },[session,status]);
  return secs;
}

/* ─── Status styling ─── */
const S={
  "in-progress":{label_ar:"جاري الإنتاج",dot:"bg-primary animate-pulse",badge:"bg-primary/10 text-primary border-primary/20"},
  paused:       {label_ar:"موقوف",        dot:"bg-orange-400",           badge:"bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800"},
  pending:      {label_ar:"انتظار",       dot:"bg-amber-400",            badge:"bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800"},
  completed:    {label_ar:"مكتمل",        dot:"bg-emerald-500",          badge:"bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800"},
} as const;

/* ─── Bag Rows ─── */
function BagRows({bags,onChange,t}:{bags:BagEntry[];onChange:(b:BagEntry[])=>void;t:(ar:string,en:string)=>string}){
  const addPreset=(kg:number)=>{if(bags.find(b=>b.weightKg===kg))return;onChange([...bags,{id:Date.now().toString(),weightKg:kg,count:0}]);};
  const addCustom=()=>onChange([...bags,{id:Date.now().toString(),weightKg:0,count:0}]);
  const upd=(id:string,field:"weightKg"|"count",val:number)=>onChange(bags.map(b=>b.id===id?{...b,[field]:Math.max(0,val)}:b));
  const rem=(id:string)=>onChange(bags.filter(b=>b.id!==id));
  return(
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">{t("أضف مقاس:","Add size:")}</span>
        {PRESET_WEIGHTS.map(kg=>(
          <button key={kg} type="button" onClick={()=>addPreset(kg)} disabled={!!bags.find(b=>b.weightKg===kg)}
            className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-muted/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary border-border">
            {kg} {t("ك","kg")}
          </button>
        ))}
        <button type="button" onClick={addCustom}
          className="px-2.5 py-1 rounded-lg border border-dashed text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all">
          + {t("مقاس مخصص","Custom")}
        </button>
      </div>
      {bags.length>0&&(
        <div className="rounded-xl border overflow-hidden divide-y">
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-3 py-2 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
            <span>{t("الوزن (ك)","Wt (kg)")}</span><span>{t("العدد","Count")}</span><span className="text-end">{t("الإجمالي","Total")}</span><span/>
          </div>
          {bags.map(b=>{
            const rowTons=(b.count*b.weightKg)/1000;
            return(
              <div key={b.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center px-3 py-2">
                <Input type="number" min="1" placeholder={t("الوزن","Weight")} className="h-8 text-xs font-mono" value={b.weightKg||""} onChange={e=>upd(b.id,"weightKg",+e.target.value)}/>
                <Input type="number" min="0" placeholder="0" className="h-8 text-xs font-mono" value={b.count||""} onChange={e=>upd(b.id,"count",+e.target.value)}/>
                <span className="text-xs font-medium text-primary text-end whitespace-nowrap">{rowTons>0?`${rowTons%1===0?rowTons:rowTons.toFixed(2)} ${t("ط","T")}`:"—"}</span>
                <button type="button" onClick={()=>rem(b.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors"><X className="w-3.5 h-3.5"/></button>
              </div>
            );
          })}
          {bags.some(b=>b.count>0&&b.weightKg>0)&&(
            <div className="flex items-center justify-between px-3 py-2 bg-primary/5 text-xs font-semibold">
              <span className="text-muted-foreground">{t("الإجمالي:","Total:")} {fmtNum(bagsTotal(bags))} {t("شيكارة","bags")}</span>
              <span className="text-primary">{bagsTotalTons(bags).toFixed(3)} {t("طن","T")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Bag Confirm Dialog ─── */
function BagConfirmDialog({open,order,onConfirm,onCancel,t}:{open:boolean;order:Order|null;onConfirm:(bags:BagEntry[])=>void;onCancel:()=>void;t:(ar:string,en:string)=>string}){
  const[bags,setBags]=useState<BagEntry[]>([]);
  useEffect(()=>{if(open&&order)setBags(order.bags.length>0?order.bags.map(b=>({...b})):[{id:"default",weightKg:50,count:Math.round(order.targetTons*1000/50)}]);},[open,order]);
  if(!order)return null;
  const total=bagsTotalTons(bags),totalCount=bagsTotal(bags),diff=+(total-order.targetTons).toFixed(3),hasData=bags.some(b=>b.count>0&&b.weightKg>0);
  return(
    <Dialog open={open} onOpenChange={v=>{if(!v)onCancel();}}>
      <DialogContent className="sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0"><PackageCheck className="w-4 h-4 text-emerald-600"/></div>
            {t("تأكيد الكميات","Confirm Quantities")}
          </DialogTitle>
          <DialogDescription className="text-xs">{order.productName} — {order.id} · {t("الكمية المستهدفة:","Target:")} <span className="font-semibold text-foreground">{order.targetTons} {t("طن","T")}</span></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/8 to-emerald-500/4 border border-emerald-500/20 px-4 py-3 flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground mb-0.5">{t("الكمية المنتجة (أطنان)","Produced (tons)")}</p><p className="font-bold text-2xl text-emerald-600">{order.targetTons}</p></div>
            <Scale className="w-9 h-9 text-emerald-500/20"/>
          </div>
          <div className="space-y-2"><p className="text-sm font-semibold">{t("توزيع الشكاير","Bag Distribution")}</p><BagRows bags={bags} onChange={setBags} t={t}/></div>
          {hasData&&diff!==0&&(
            <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${Math.abs(diff)<0.1?"bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800":"bg-destructive/8 border border-destructive/20 text-destructive"}`}>
              <span className="font-semibold">{diff>0?`+${diff}`:diff} {t("طن","T")}</span>
              <span>{t("فرق عن الكمية المستهدفة","difference from target")}</span>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={()=>onConfirm(bags)} disabled={!hasData}>
              <CheckCircle2 className="w-4 h-4"/>{t("تأكيد الإنتاج","Confirm Production")}
            </Button>
            <Button variant="outline" onClick={onCancel}>{t("إلغاء","Cancel")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Resume Dialog ─── */
function ResumeDialog({open,order,onConfirm,onCancel,t}:{open:boolean;order:Order|null;onConfirm:(end:string)=>void;onCancel:()=>void;t:(ar:string,en:string)=>string}){
  const[endTime,setEndTime]=useState("");const startRef=useRef(nowTime24());
  useEffect(()=>{if(open){startRef.current=nowTime24();setEndTime("");}  },[open]);
  if(!order)return null;
  return(
    <Dialog open={open} onOpenChange={v=>{if(!v)onCancel();}}>
      <DialogContent className="sm:max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><PlayCircle className="w-4 h-4 text-primary"/></div>
            {t("استئناف الإنتاج","Resume Production")}
          </DialogTitle>
          <DialogDescription className="text-xs">{order.productName} — {order.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/15 px-4 py-3.5 flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground mb-1">{t("وقت البدء التلقائي","Auto start time")}</p><p className="font-bold text-2xl font-mono text-primary">{to12h(startRef.current)}</p></div>
            <Zap className="w-9 h-9 text-primary/20"/>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t("وقت الانتهاء المتوقع","Expected end time")}</Label>
            <Input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="font-mono"/>
            {endTime&&<p className="text-xs text-muted-foreground">{to12h(endTime)} • {t("المدة","Duration")}: <span className="text-primary font-medium">{fmtMins(calcDurationMins(startRef.current,endTime))}</span></p>}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={()=>onConfirm(endTime)}><PlayCircle className="w-4 h-4"/>{t("استئناف الآن","Resume Now")}</Button>
            <Button variant="outline" onClick={onCancel}>{t("إلغاء","Cancel")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Substitution Suggestions Panel ─── */
const formatter = new Intl.NumberFormat("ar-EG");
const currencyFmt = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

function SubstitutionSuggestionsPanel({
  alerts, accepted, rejected, onApprove, onReject, t
}: {
  alerts: SubResult[];
  accepted: Set<string>;
  rejected: Set<string>;
  onApprove: (alert: SubResult, suggestionIdx: number) => void;
  onReject: (alert: SubResult, suggestionIdx: number) => void;
  t: (ar: string, en: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (alerts.length === 0) return null;
  return (
    <div className="rounded-2xl border border-primary/10 bg-card overflow-hidden">
      {/* ── Clickable header ── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-start"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{t("اقتراحات الاستبدال الذكي", "Smart Substitution Suggestions")}</span>
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {alerts.reduce((s, a) => s + a.suggestions.length, 0)} {t("اقتراح", "suggestion(s)")}
          </span>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* ── Collapsible content ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border/60"
          >
              <div className="divide-y divide-border/40">
      {alerts.map(alert => (
        <div key={alert.orderId} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/60 flex items-center gap-2">
            <Factory className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">{alert.productName}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{alert.orderId}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium me-auto">
              {t("التكلفة الحالية", "Current")}: {currencyFmt(alert.totalOriginalCost)}
              {" → "}
              {currencyFmt(alert.totalNewCost)}
              {" "}
              <span className={alert.totalImpact > 0 ? "text-destructive" : "text-emerald-600"}>
                ({alert.totalImpact > 0 ? "+" : ""}{currencyFmt(alert.totalImpact)})
              </span>
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {alert.suggestions.map((s, idx) => {
              const key = `${alert.orderId}|${s.originalMaterial}│${s.substituteMaterial}`;
              const isAccepted = accepted.has(key);
              const isRejected = rejected.has(key);
              const diff = s.substitutePricePerTon - s.originalPricePerTon;
              return (
                <div key={key} className={`px-3 py-2.5 transition-colors ${isAccepted ? "bg-emerald-50/50 dark:bg-emerald-950/20" : isRejected ? "bg-destructive/5" : ""}`}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 sm:gap-x-4 gap-y-1.5 text-xs">
                    {/* Original */}
                    <div>
                      <span className="text-[10px] text-muted-foreground/60">{t("المادة الأصلية", "Original")}</span>
                      <p className="font-semibold truncate">{s.originalMaterial}</p>
                    </div>
                    {/* Substitute */}
                    <div>
                      <span className="text-[10px] text-muted-foreground/60">{t("البديل", "Substitute")}</span>
                      <p className="font-semibold truncate text-primary">{s.substituteMaterial}</p>
                    </div>
                    {/* Price comparison */}
                    <div>
                      <span className="text-[10px] text-muted-foreground/60">{t("السعر", "Price")}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground line-through">{formatter.format(s.originalPricePerTon)}</span>
                        <span className="font-medium">{formatter.format(s.substitutePricePerTon)}</span>
                        <span className={`text-[10px] font-bold ${diff > 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {diff > 0 ? "+" : ""}{formatter.format(diff)} {t("ج.م.", "EGP")}
                        </span>
                      </div>
                    </div>
                    {/* Quantity */}
                    <div>
                      <span className="text-[10px] text-muted-foreground/60">{t("الكمية", "Qty")}</span>
                      <p className="font-medium">{t("المطلوب", "Need")}: {s.neededTons.toFixed(1)} {t("ط", "T")} · {t("متوفر", "Avail")}: {formatter.format(Math.round(s.substituteAvailableTons))} {t("ط", "T")}</p>
                    </div>
                  </div>
                  {/* Confidence + AI rationale row */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      s.confidence >= 70
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : s.confidence >= 40
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      {t("ثقة", "Confidence")} {s.confidence}%
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      <span className="font-semibold text-foreground/60">AI</span> {s.aiRationale}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="mt-2 flex items-center gap-1.5">
                    {!isAccepted && !isRejected ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onApprove(alert, idx)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {t("اعتماد", "Approve")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(alert, idx)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
                        >
                          <X className="w-3 h-3" />
                          {t("رفض", "Reject")}
                        </button>
                      </>
                    ) : (
                      <span className={`text-[11px] font-medium flex items-center gap-1 ${isAccepted ? "text-emerald-600" : "text-destructive"}`}>
                        {isAccepted ? <><CheckCircle2 className="w-3 h-3" />{t("تم الاعتماد", "Approved")}</> : <><X className="w-3 h-3" />{t("تم الرفض", "Rejected")}</>}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
              ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

/* ─── Substitution Row ─── */
function SubstitutionIngredientRow({ ing, needed, t }: {
  ing: ResolvedIngredient;
  needed: number;
  t: (ar: string, en: string) => string;
}) {
  const hasSwap = !!ing.substitution;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-1"
    >
      <div className="flex justify-between text-xs items-start gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Animated material name — swipes when substituted */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.span
                key={ing.material}
                initial={{ x: hasSwap ? 30 : 0, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={`block font-medium ${hasSwap ? "text-amber-700 dark:text-amber-400" : ""}`}
              >
                {ing.material}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Substitution badge */}
          {hasSwap && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 260 }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400 text-[10px] font-medium whitespace-nowrap"
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              {t(`بدل: ${ing.substitution!.originalMaterial}`, `Subst: ${ing.substitution!.originalMaterial}`)}
            </motion.div>
          )}
        </div>
        <span className="font-bold text-primary shrink-0">{needed.toFixed(1)} {t("ط","T")}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${hasSwap ? "bg-amber-400" : "bg-primary"}`}
          initial={{ width: 0 }}
          animate={{ width: `${ing.pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </motion.div>
  );
}

/* ─── Order Card ─── */
function OrderCard({order,onStop,onResumeClick,onCompleteClick,onDelete,onEdit,onBagsClick,t,cardIndex}:{
  order:Order;onStop:(id:string)=>void;onResumeClick:(o:Order)=>void;
  onCompleteClick:(o:Order)=>void;onDelete:(id:string)=>void;onEdit:(o:Order)=>void;
  onBagsClick:(o:Order)=>void;
  t:(ar:string,en:string)=>string;cardIndex:number;
}){
  const activeSession=getActive(order),elapsed=useLiveTimer(activeSession,order.status);
  const progress=getProgress(order),remaining=order.targetTons-order.producedTons,cardWork=getCardWork(order);
  const st=S[order.status],isActive=order.status==="in-progress",isPaused=order.status==="paused",isDone=order.status==="completed";
  const lastEndedSess=[...order.sessions].reverse().find(s=>s.endedAt!==null);
  const totalBags=bagsTotal(order.bags);
  const hasBags=order.bags.length>0&&order.bags.some(b=>b.count>0);
  return(
    <motion.div layout initial={{opacity:0,y:16,scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,x:-20,scale:0.97}} transition={{duration:0.3,ease:"easeOut",delay:cardIndex*0.05}}>
      <div className={`relative rounded-2xl border bg-card overflow-hidden transition-all duration-300 ${isActive?"border-primary/30 shadow-lg shadow-primary/8":isPaused?"border-orange-300/40":isDone?"border-emerald-200/50":"border-border"}`}>
        {isActive&&<motion.div className="absolute inset-0 pointer-events-none z-0" style={{background:"linear-gradient(90deg,transparent 0%,hsl(var(--primary)/0.07) 50%,transparent 100%)"}} animate={{x:["-100%","200%"]}} transition={{duration:2.2,repeat:Infinity,ease:"linear",delay:cardIndex*0.35}}/>}
        <div className="relative h-[3px] w-full bg-muted/40 z-10">
          <motion.div className={`absolute inset-y-0 left-0 ${isActive?"bg-primary":isPaused?"bg-orange-400":isDone?"bg-emerald-500":"bg-muted"}`} animate={{width:isDone?"100%":isActive||isPaused?`${progress}%`:"0%"}} transition={{duration:1,ease:"easeOut"}}/>
          {isActive&&<motion.div className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent" animate={{left:["-10%","110%"]}} transition={{duration:1.5,repeat:Infinity,ease:"linear",delay:cardIndex*0.35+0.4}}/>}
        </div>
        <div className="relative z-10 p-3 sm:p-4">
          {/* Row 1 */}
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isActive?"bg-primary text-primary-foreground shadow-sm shadow-primary/30":isPaused?"bg-orange-100 dark:bg-orange-900/40":isDone?"bg-emerald-100 dark:bg-emerald-900/40":"bg-muted"}`}>
              <Factory className={`w-4 h-4 sm:w-5 sm:h-5 ${isPaused?"text-orange-500":isDone?"text-emerald-600":isActive?"":"text-muted-foreground"}`}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm leading-tight truncate">{order.productName}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${st.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`}/>
                  {t(st.label_ar,order.status==="in-progress"?"Active":order.status==="paused"?"Paused":order.status==="completed"?"Done":"Pending")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{order.id} · {fmtDate(order.date)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isActive&&<Button size="sm" className="gap-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-7 sm:h-8 px-2 sm:px-3 text-xs" onClick={()=>onStop(order.id)}><StopCircle className="w-3.5 h-3.5"/><span className="hidden sm:inline">{t("وقف","Stop")}</span></Button>}
              {isPaused&&<Button size="sm" className="gap-1 rounded-xl h-7 sm:h-8 px-2 sm:px-3 text-xs" onClick={()=>onResumeClick(order)}><PlayCircle className="w-3.5 h-3.5"/><span className="hidden sm:inline">{t("استئناف","Resume")}</span></Button>}
              <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-foreground" onClick={()=>onEdit(order)}><Pencil className="w-3.5 h-3.5"/></Button>
              {!isDone&&<Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" onClick={()=>onCompleteClick(order)}><CheckCircle2 className="w-3.5 h-3.5"/></Button>}
              <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={()=>onDelete(order.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
            </div>
          </div>
          {/* Row 2 */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              {(isActive||isPaused||isDone)&&order.producedTons>0?(
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">{order.producedTons} / {order.targetTons} {t("ط","T")}</span><span className={`font-bold ${isDone?"text-emerald-600":isPaused?"text-orange-500":"text-primary"}`}>{progress}%</span></div>
                  <div className="relative h-1.5 rounded-full bg-muted overflow-hidden"><motion.div className={`absolute inset-y-0 left-0 rounded-full ${isPaused?"bg-orange-400":isDone?"bg-emerald-500":"bg-primary"}`} animate={{width:`${progress}%`}} transition={{duration:0.9,ease:"easeOut"}}/></div>
                  {!isDone&&remaining>0&&<p className="text-[11px] text-orange-500">{t(`متبقي ${remaining}ط`,`${remaining}T left`)}</p>}
                </div>
              ):(
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Package className="w-3.5 h-3.5 shrink-0"/><span>{order.targetTons} {t("طن مستهدف","T target")}</span></div>
              )}
            </div>
            <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-2 sm:gap-1 shrink-0">
              {order.plannedStart&&<div className="flex items-center gap-1 text-xs text-muted-foreground font-mono"><Clock className="w-3 h-3 shrink-0"/><span>{to12h(order.plannedStart)}</span>{order.plannedEnd&&<><span className="opacity-40">→</span><span>{to12h(order.plannedEnd)}</span></>}</div>}
              <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                {isActive&&activeSession?(
                  <motion.div className="font-mono font-bold text-primary text-base" animate={{opacity:[0.55,1]}} transition={{repeat:Infinity,duration:1,ease:"easeInOut"}}>{fmtElapsed(elapsed)}</motion.div>
                ):cardWork>0?(<div className="flex items-center gap-1 text-xs font-medium text-primary"><Timer className="w-3 h-3"/>{fmtMins(cardWork)}</div>):null}
                {isPaused&&lastEndedSess&&<p className="text-[11px] text-orange-500 font-mono">{to12h(lastEndedSess.startedAt)}→{lastEndedSess.endedAt?to12h(lastEndedSess.endedAt):"--"}{lastEndedSess.durationMins!==null&&<span className="ms-1 opacity-70">({fmtMins(lastEndedSess.durationMins)})</span>}</p>}
                {order.sessions.length>1&&<div className="flex items-center gap-1 text-[11px] text-muted-foreground"><History className="w-3 h-3"/><span>{order.sessions.length} {t("جلسات","sess.")}</span></div>}
              </div>
            </div>
          </div>

          {/* Row 3: bags — CLICKABLE */}
          {hasBags&&(
            <div className="mt-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <PackageCheck className={`w-3.5 h-3.5 ${isDone?"text-emerald-600":"text-primary"}`}/><span className="font-medium">{t("الشكاير:","Bags:")}</span>
                </div>
                {order.bags.filter(b=>b.count>0&&b.weightKg>0).map(b=>(
                  <span key={b.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${isDone?"bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800":"bg-primary/8 text-primary border-primary/20"}`}>
                    {fmtNum(b.count)} × {b.weightKg}{t("ك","kg")}
                  </span>
                ))}
                {/* Clickable total count */}
                <button
                  onClick={() => onBagsClick(order)}
                  className={`group flex items-center gap-1 text-xs rounded-lg px-2 py-0.5 transition-all
                    ${isDone
                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800"
                      : "bg-primary/8 hover:bg-primary/15 text-primary border border-primary/20"
                    }`}
                >
                  = <span className="font-black text-sm group-hover:scale-110 transition-transform inline-block">{fmtNum(totalBags)}</span>
                  <span className="opacity-70">{t("شيكارة","bags")}</span>
                  <PackageCheck className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Edit Sheet ─── */
function EditOrderSheet({order,open,onClose,onSave,t}:{order:Order|null;open:boolean;onClose:()=>void;onSave:(o:Order)=>void;t:(ar:string,en:string)=>string}){
  const{warehouseConfigs}=useProductionStore();
  const[form,setForm]=useState<Order|null>(null);
  useEffect(()=>{if(order)setForm({...order,sessions:order.sessions.map(s=>({...s})),bags:order.bags.map(b=>({...b}))});},[order]);
  if(!form)return null;
  const progress=form.targetTons>0?Math.min(100,Math.round(form.producedTons/form.targetTons*100)):0;
  const remaining=Math.max(0,form.targetTons-form.producedTons);
  return(
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6"><SheetTitle>{t("تعديل أمر الإنتاج","Edit Production Order")}</SheetTitle><SheetDescription>{form.id} — {form.productName}</SheetDescription></SheetHeader>
        <div className="space-y-5">
          <div className="space-y-2"><Label>{t("المنتج","Product")}</Label><div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">{form.productName}</div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-2"><Label>{t("الكمية المستهدفة (طن)","Target (Tons)")}</Label><Input type="number" min="1" value={form.targetTons} onChange={e=>setForm(f=>f?{...f,targetTons:+e.target.value||0}:f)}/></div>
            <div className="space-y-2"><Label>{t("الكمية المنتجة (طن)","Produced (Tons)")}</Label><Input type="number" min="0" max={form.targetTons} value={form.producedTons} onChange={e=>setForm(f=>f?{...f,producedTons:Math.min(+e.target.value||0,f.targetTons)}:f)}/></div>
          </div>
          {form.producedTons>0&&form.producedTons<form.targetTons&&<div className="space-y-1"><Progress value={progress} className="h-1.5"/><p className="text-xs text-orange-500">{t(`متبقي: ${remaining} طن`,`Remaining: ${remaining} tons`)}</p></div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-2"><Label>{t("وقت البدء","Start")}</Label><Input type="time" value={form.plannedStart} onChange={e=>setForm(f=>f?{...f,plannedStart:e.target.value}:f)}/>{form.plannedStart&&<p className="text-xs text-muted-foreground">{to12h(form.plannedStart)}</p>}</div>
            <div className="space-y-2"><Label>{t("وقت الانتهاء","End")}</Label><Input type="time" value={form.plannedEnd} onChange={e=>setForm(f=>f?{...f,plannedEnd:e.target.value}:f)}/>{form.plannedEnd&&<p className="text-xs text-muted-foreground">{to12h(form.plannedEnd)}</p>}</div>
          </div>
          <div className="space-y-2">
            <Label>{t("الحالة","Status")}</Label>
            <Select value={form.status} onValueChange={v=>setForm(f=>f?{...f,status:v as OrderStatus}:f)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{(["pending","in-progress","paused","completed"] as const).map(s=><SelectItem key={s} value={s}>{t(S[s].label_ar,s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("المخزن","Warehouse")}</Label>
            <Select value={form.warehouseId} onValueChange={v=>setForm(f=>f?{...f,warehouseId:v}:f)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{warehouseConfigs.map(w=><SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-2"><Button className="flex-1" onClick={()=>{onSave(form);onClose();}}>{t("حفظ","Save")}</Button><Button variant="outline" onClick={onClose}>{t("إلغاء","Cancel")}</Button></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Main Page ─── */
type FilterStatus="all"|OrderStatus;
type DateMode="all"|"today"|"range";
type PageTab="orders"|"formulas";

export default function Production(){
  const{t,setSubstitutionAlerts:setGlobalAlerts,registerSubstitutionHandlers,companyName,companyAddress,companyLogo}=useAppStore();
  const{products}=mockData;
  const{orders,addOrder,updateOrder,deleteOrder,formulas,updateFormula,deleteFormula,inventory,setInventory,consumeRawMaterials,addFinishedProduct,warehouseConfigs}=useProductionStore();

  const[activeTab,setActiveTab]=useState<PageTab>("orders");
  const[sheetOpen,setSheetOpen]=useState(false);
  const[editOpen,setEditOpen]=useState(false);
  const[editOrder,setEditOrder]=useState<Order|null>(null);
  const[resumeOpen,setResumeOpen]=useState(false);
  const[resumeTarget,setResumeTarget]=useState<Order|null>(null);
  const[bagOpen,setBagOpen]=useState(false);
  const[bagTarget,setBagTarget]=useState<Order|null>(null);
  const[filterStatus,setFilterStatus]=useState<FilterStatus>("all");
  const[dateMode,setDateMode]=useState<DateMode>("all");
  const[dateFrom,setDateFrom]=useState("");
  const[dateTo,setDateTo]=useState("");
  const[selProductId,setSelProductId]=useState("");
  const[productSearch,setProductSearch]=useState("");
  const[targetTons,setTargetTons]=useState("");
  const[formBagWeight,setFormBagWeight]=useState(50);
  const[formBagCount,setFormBagCount]=useState("");
  const[newStart,setNewStart]=useState("");
  const[newEnd,setNewEnd]=useState("");
  const[newWarehouse,setNewWarehouse]=useState("");
  const[submitted,setSubmitted]=useState(false);
  const[newBags,setNewBags]=useState<BagEntry[]>([]);

  // ── Production Report state ──
  const[reportOpen,setReportOpen]=useState(false);
  const[reportDateMode,setReportDateMode]=useState<DateMode>("all");
  const[reportDateFrom,setReportDateFrom]=useState("");
  const[reportDateTo,setReportDateTo]=useState("");
  const[reportGenerated,setReportGenerated]=useState(false);
  const[reportGenerating,setReportGenerating]=useState(false);
  const[reportSummary,setReportSummary]=useState(true);
  const[reportShortages,setReportShortages]=useState(true);
  const[reportSubstitutions,setReportSubstitutions]=useState(true);
  const[reportOrderList,setReportOrderList]=useState(true);

  // Bags breakdown dialog state
  const[bagsDialogOpen,setBagsDialogOpen]=useState(false);
  const[bagsDialogOrder,setBagsDialogOrder]=useState<Order|null>(null);
  const[showBagsPopover,setShowBagsPopover]=useState(false);
  const[showWorkPopover,setShowWorkPopover]=useState(false);
  const[bagsLoading,setBagsLoading]=useState(false);

  // Simulate bags loading every ~5 minutes (2-3 pulses)
  useEffect(()=>{
    let active=true;
    const schedule=()=>{
      if(!active)return;
      const delay=4.5*60*1000+Math.random()*60*1000; // 4.5-5.5 min
      setTimeout(()=>{
        if(!active)return;
        const pulses=2+Math.floor(Math.random()*2); // 2-3 pulses
        let pi=0;
        const pulse=()=>{
          if(!active||pi>=pulses){schedule();return;}
          setBagsLoading(true);
          const onTime=800+Math.random()*700; // 0.8-1.5s
          const offTime=1200+Math.random()*800; // 1.2-2s
          setTimeout(()=>{
            if(!active)return;
            setBagsLoading(false);
            pi++;
            setTimeout(pulse,offTime);
          },onTime);
        };
        pulse();
      },delay);
    };
    schedule();
    return ()=>{active=false;};
  },[]);

  // AI Substitution state
  const[substitutionLoading,setSubstitutionLoading]=useState(false);
  const[substitutionAlerts,setSubstitutionAlerts]=useState<SubResult[]>([]);
  const[aiAnalyzing,setAiAnalyzing]=useState(false);
  const[aiSuggestionResult,setAiSuggestionResult]=useState<SubResult|null>(null);
  // Per-suggestion tracking: key = `${orderId}|${originalMaterial}│${substituteMaterial}`
  const[suggAccepted,setSuggAccepted]=useState<Set<string>>(new Set());
  const[suggRejected,setSuggRejected]=useState<Set<string>>(new Set());

  // Build price-aware inventory for the substitution engine
  const pricedInventory = useMemo(() => {
    return inventory
      .filter(i => i.type === "raw")
      .map(i => {
        // Find price from catalog or estimate
        let price = getMaterialPrice(i.materialName, inventory);
        // If zero or unknown, estimate from catalog group
        if (!price || price <= 0) {
          for (const group of Object.values(MATERIAL_CATALOG)) {
            const m = group.find(m => m.name === i.materialName);
            if (m) { price = m.pricePerTon; break; }
          }
        }
        return {
          id: i.id,
          name: i.materialName,
          category: i.materialName.includes("ذرة") ? "corn" : i.materialName.includes("صويا") ? "soy" : "other",
          pricePerTon: price || 12500,
          availableTons: i.unit === "kg" ? i.quantity / 1000 : i.quantity,
          unit: "ton" as const,
          substitutionGroup: i.materialName.includes("ذرة") ? "corn" : i.materialName.includes("صويا") ? "soy" : undefined,
        };
      });
  }, [inventory]);

  // Monitor inventory levels for active orders
  useEffect(() => {
    const activeOrders = orders.filter(o => o.status === "in-progress" || o.status === "pending" || o.status === "paused");
    const alerts: SubResult[] = [];

    for (const order of activeOrders) {
      const formula = formulas[order.productId];
      if (!formula) continue;

      const result = suggestSubstitutions(
        formula,
        pricedInventory,
        order.targetTons,
        order.id,
        order.productId,
        order.productName,
      );

      if (result.suggestions.length > 0) {
        // Filter out per-suggestion accepted/rejected
        const filteredSugg = result.suggestions.filter(s => {
          const key = `${order.id}|${s.originalMaterial}│${s.substituteMaterial}`;
          return !suggAccepted.has(key) && !suggRejected.has(key);
        });
        if (filteredSugg.length > 0) {
          alerts.push({ ...result, suggestions: filteredSugg });
        }
      }
    }

    setSubstitutionAlerts(alerts);
    setGlobalAlerts(alerts);
  }, [orders, formulas, pricedInventory, suggAccepted, suggRejected]);

  // Track which substitution toasts have been shown
  const shownSubstitutions = useRef<Set<string>>(new Set());

  const filtered=orders.filter(o=>{
    if(filterStatus!=="all"&&o.status!==filterStatus)return false;
    if(dateMode==="today")return o.date===nowDate();
    if(dateMode==="range"){if(dateFrom&&o.date<dateFrom)return false;if(dateTo&&o.date>dateTo)return false;}
    return true;
  });
  const counts={"in-progress":0,paused:0,pending:0,completed:0} as Record<OrderStatus,number>;
  filtered.forEach(o=>counts[o.status]++);
  const totalProduced=filtered.reduce((s,o)=>s+o.producedTons,0);
  const totalTarget=filtered.reduce((s,o)=>s+o.targetTons,0);
  const totalWorkedMins=calcUnionWorkMins(filtered);
  const totalBagsAll=filtered.reduce((s,o)=>s+bagsTotal(o.bags),0);
  const globalAggBags=useMemo(()=>{
    const map=new Map<number,{weightKg:number;count:number;id:string}>();
    let idx=0;
    for(const o of filtered){
      for(const b of o.bags){
        if(b.count<=0||b.weightKg<=0)continue;
        const key=b.weightKg;
        if(map.has(key))map.get(key)!.count+=b.count;
        else map.set(key,{weightKg:key,count:b.count,id:`gb-${idx++}`});
      }
    }
    return Array.from(map.values()).sort((a,b)=>a.weightKg-b.weightKg);
  },[filtered]);

  const selProduct=products.find(p=>p.id===selProductId);
  const tonsNum=parseFloat(targetTons)||0;
  const formula=selProductId?formulas[selProductId]||[]:[];
  const costPerTon=selProduct?selProduct.wholeSalePrice:0;
  const rawInventory=inventory.filter(i=>i.type==="raw");

  // Compute resolved formula with auto-substitutions
  const resolvedFormula = useMemo<ResolvedIngredient[]>(()=>{
    if(!selProductId||tonsNum<=0||formula.length===0) return formula as ResolvedIngredient[];
    return resolveFormulaIngredients(formula, rawInventory, tonsNum);
  },[selProductId, tonsNum, formula, rawInventory]);

  // Per-warehouse material availability for the selected product's formula
  const warehouseAvail = useMemo(() => {
    const map = new Map<string, { available: number; total: number }>();
    if (!selProductId || formula.length === 0) return map;
    for (const w of warehouseConfigs) {
      const whInv = inventory.filter(i => i.type === "raw" && i.warehouseId === w.id);
      let available = 0;
      for (const ing of formula) {
        if (findInventoryMatch(ing.material, whInv)) available++;
      }
      map.set(w.id, { available, total: formula.length });
    }
    return map;
  }, [selProductId, formula, inventory, warehouseConfigs]);

  // Fire substitution toasts whenever resolved formula changes
  useEffect(()=>{
    if(!selProductId||tonsNum<=0) return;
    resolvedFormula.forEach(ing=>{
      if(!ing.substitution) return;
      const key = `${selProductId}|${ing.substitution.originalMaterial}→${ing.substitution.replacedWith}`;
      if(shownSubstitutions.current.has(key)) return;
      shownSubstitutions.current.add(key);
      const reason = ing.substitution.reason === "out_of_stock"
        ? t("نفدت من المخزون","out of stock")
        : t("كمية غير كافية","insufficient stock");
      toast.warning(
        `🔄 ${t("تم الاستبدال التلقائي","Auto-substituted")}`,
        {
          description: t(
            `${ing.substitution.originalMaterial} (${reason}) → ${ing.substitution.replacedWith}`,
            `${ing.substitution.originalMaterial} (${reason}) → ${ing.substitution.replacedWith}`,
          ),
          duration: 6000,
          icon: <Bell className="w-4 h-4 text-amber-500"/>,
        }
      );
    });
  },[resolvedFormula, selProductId, tonsNum, t]);

  // Reset shown substitutions when product or sheet changes
  useEffect(()=>{
    shownSubstitutions.current.clear();
    setAiSuggestionResult(null);
  },[selProductId, sheetOpen]);

  const hasSubstitutions = resolvedFormula.some(i=>!!i.substitution);

  const handleSubmit=()=>{
    if(!selProductId||!targetTons||!newWarehouse)return;
    const prod=products.find(p=>p.id===selProductId);if(!prod)return;
    addOrder({id:`PRD-${String(orders.length+44).padStart(4,"0")}`,productId:selProductId,productName:prod.name,targetTons:tonsNum,producedTons:0,status:"pending",date:nowDate(),plannedStart:newStart,plannedEnd:newEnd,sessions:[],bags:newBags,warehouseId:newWarehouse});
    setSubmitted(true);
    setTimeout(()=>{setSubmitted(false);setSheetOpen(false);setSelProductId("");setProductSearch("");setTargetTons("");setFormBagWeight(50);setFormBagCount("");setNewStart("");setNewEnd("");setNewWarehouse("");setNewBags([]);},1500);
  };
  const handleStop=(id:string)=>{
    const time=nowTime24(),order=orders.find(o=>o.id===id);if(!order)return;
    const ss=[...order.sessions];const last=ss.length-1;
    if(last>=0&&ss[last].endedAt===null){ss[last]={...ss[last],endedAt:time,durationMins:calcDurationMins(ss[last].startedAt,time)};}
    updateOrder(id,{status:"paused",sessions:ss});
  };
  const handleResumeConfirm=(endTime:string)=>{
    if(!resumeTarget)return;
    const order=orders.find(o=>o.id===resumeTarget.id);if(!order)return;
    const startedAt=nowTime24();
    updateOrder(resumeTarget.id,{status:"in-progress",plannedEnd:endTime||order.plannedEnd,sessions:[...order.sessions,{date:nowDate(),startedAt,endedAt:null,durationMins:null}]});
    setResumeOpen(false);setResumeTarget(null);setFilterStatus("in-progress");
  };
  // ── Per-suggestion approve/reject ──
  const handleSuggApprove = (alert: SubResult, idx: number) => {
    const suggestion = alert.suggestions[idx];
    const key = `${alert.orderId}|${suggestion.originalMaterial}│${suggestion.substituteMaterial}`;
    setSuggAccepted(prev => new Set([...prev, key]));
    const updatedInventory = [...inventory];
    const matchIdx = updatedInventory.findIndex(i => i.materialName === suggestion.originalMaterial);
    if (matchIdx !== -1) {
      updatedInventory[matchIdx] = { ...updatedInventory[matchIdx], quantity: 0, alertLevel: "critical" };
    }
    const subExists = updatedInventory.find(i => i.materialName === suggestion.substituteMaterial);
    if (subExists) {
      const subIdx = updatedInventory.findIndex(i => i.id === subExists.id);
      const deducted = subExists.unit === "kg" ? suggestion.neededTons * 1000 : suggestion.neededTons;
      updatedInventory[subIdx] = { ...subExists, quantity: Math.max(0, subExists.quantity - deducted) };
    }
    setInventory(updatedInventory);
    toast.success(`✅ ${t("تم اعتماد الاستبدال", "Substitution Approved")}`, {
      description: t(`استبدال ${suggestion.originalMaterial} → ${suggestion.substituteMaterial}`, `${suggestion.originalMaterial} → ${suggestion.substituteMaterial}`),
      duration: 4000,
    });
  };
  const handleSuggReject = (alert: SubResult, idx: number) => {
    const suggestion = alert.suggestions[idx];
    const key = `${alert.orderId}|${suggestion.originalMaterial}│${suggestion.substituteMaterial}`;
    setSuggRejected(prev => new Set([...prev, key]));
    toast.info(`❌ ${t("تم رفض الاستبدال", "Substitution Rejected")}`, {
      description: t(`رفض استبدال ${suggestion.originalMaterial}`, `Rejected substitution for ${suggestion.originalMaterial}`),
      duration: 4000,
    });
  };

  // ── Global (order-level) approve/reject handlers for the header dialog ──
  const approveRef = useRef(async (_: string) => {});
  const rejectRef = useRef(async (_: string) => {});
  approveRef.current = async (requestId: string) => {
    const alert = substitutionAlerts.find(a => a.orderId === requestId);
    if (!alert) return;
    for (const suggestion of alert.suggestions) {
      const key = `${alert.orderId}|${suggestion.originalMaterial}│${suggestion.substituteMaterial}`;
      setSuggAccepted(prev => new Set([...prev, key]));
    }
    const updatedInventory = [...inventory];
    for (const suggestion of alert.suggestions) {
      const matchIdx = updatedInventory.findIndex(i => i.materialName === suggestion.originalMaterial);
      if (matchIdx === -1) continue;
      updatedInventory[matchIdx] = { ...updatedInventory[matchIdx], quantity: 0, alertLevel: "critical" };
      const subExists = updatedInventory.find(i => i.materialName === suggestion.substituteMaterial);
      if (subExists) {
        const subIdx = updatedInventory.findIndex(i => i.id === subExists.id);
        updatedInventory[subIdx] = { ...subExists, quantity: Math.max(0, subExists.quantity - suggestion.neededTons) };
      }
    }
    setInventory(updatedInventory);
    toast.success(`✅ ${t("تم اعتماد الاستبدال", "Substitution Approved")}`, {
      description: t(`تم استبدال ${alert.suggestions.length} مادة في ${alert.productName}`, `${alert.suggestions.length} material(s) substituted in ${alert.productName}`),
      duration: 5000,
    });
  };
  rejectRef.current = async (requestId: string) => {
    const alert = substitutionAlerts.find(a => a.orderId === requestId);
    if (!alert) return;
    for (const suggestion of alert.suggestions) {
      const key = `${alert.orderId}|${suggestion.originalMaterial}│${suggestion.substituteMaterial}`;
      setSuggRejected(prev => new Set([...prev, key]));
    }
    toast.info(`❌ ${t("تم رفض الاستبدال", "Substitution Rejected")}`, {
      description: t(`سيستمر الإنتاج بالخامات المتاحة`, `Production will continue with available materials`),
      duration: 4000,
    });
  };

  // Register once on mount (refs always point to latest)
  useEffect(() => {
    registerSubstitutionHandlers(
      (id) => approveRef.current(id),
      (id) => rejectRef.current(id),
    );
  }, []);

  // AI analyze button for new orders
  const handleAiAnalyze = () => {
    if (!selProductId || !targetTons) return;
    setAiAnalyzing(true);
    setAiSuggestionResult(null);
    setTimeout(() => {
      const formula = formulas[selProductId] || [];
      const result = suggestSubstitutions(
        formula, pricedInventory, parseFloat(targetTons) || 0,
        `PRD-${String(orders.length + 44).padStart(4, "0")}`,
        selProductId, products.find(p => p.id === selProductId)?.name || "",
      );
      if (result.suggestions.length > 0) {
        setAiSuggestionResult(result);
      } else {
        setAiSuggestionResult(null);
        toast.success(t("جميع الخامات متوفرة", "All materials available"), {
          description: t("لا حاجة للاستبدال", "No substitution needed"),
          duration: 3000,
        });
      }
      setAiAnalyzing(false);
    }, 1500);
  };

  const handleCompleteClick=(order:Order)=>{setBagTarget(order);setBagOpen(true);};
  const handleBagConfirm=(bags:BagEntry[])=>{
    if(!bagTarget)return;
    const time=nowTime24(),order=orders.find(o=>o.id===bagTarget.id);if(!order)return;
    const ss=[...order.sessions];const last=ss.length-1;
    if(last>=0&&ss[last].endedAt===null){ss[last]={...ss[last],endedAt:time,durationMins:calcDurationMins(ss[last].startedAt,time)};}
    const totalBagTons=bagsTotalTons(bags),finalTons=totalBagTons>0?+totalBagTons.toFixed(3):bagTarget.targetTons,totalCount=bagsTotal(bags);
    updateOrder(bagTarget.id,{status:"completed",producedTons:finalTons,bags,sessions:ss});
    // Pass resolved ingredients so substituted materials get deducted correctly
    const resolvedForCompletion = resolveFormulaIngredients(
      formulas[bagTarget.productId]||[], rawInventory, finalTons
    );
    consumeRawMaterials(bagTarget.productId, finalTons, resolvedForCompletion, bagTarget.warehouseId);
    addFinishedProduct(bagTarget.productId,bagTarget.productName,finalTons,bagTarget.warehouseId);
    const newCost = usePricingStore.getState().calculateFormulaCost(bagTarget.productId) || Math.round((mockData.products.find(p => p.id === bagTarget.productId)?.wholeSalePrice || 0) * 0.75);
    usePricingStore.getState().addPricingAlert(bagTarget.productName, newCost, "production");
    const bagSummary=bags.filter(b=>b.count>0&&b.weightKg>0).map(b=>`${fmtNum(b.count)} × ${b.weightKg}ك`).join(" + ");
    toast.success(`✅ ${bagTarget.productName}`,{description:`${fmtNum(totalCount)} شيكارة${bagSummary?` (${bagSummary})`:""} = ${finalTons} طن — تم خصم الخامات من المخزون`,duration:6000});
    setBagOpen(false);setBagTarget(null);
  };
  const handleDelete=(id:string)=>deleteOrder(id);
  const handleEdit=(o:Order)=>{setEditOrder(o);setEditOpen(true);};
  const handleSaveEdit=(u:Order)=>updateOrder(u.id,u);
  const clearDateFilter=()=>{setDateMode("all");setDateFrom("");setDateTo("");};

  // ── Production Report ──
  const handleGenerateProductionReport=()=>{
    if(reportDateMode==="range"&&!reportDateFrom&&!reportDateTo)return;
    setReportGenerating(true);
    setTimeout(()=>{setReportGenerating(false);setReportGenerated(true);},1200);
  };
  const handleDownloadProductionPDF=()=>{
    const reportOrders=orders.filter(o=>{
      if(reportDateMode==="all")return true;
      if(reportDateMode==="today")return o.date===nowDate();
      if(reportDateMode==="range"){if(reportDateFrom&&o.date<reportDateFrom)return false;if(reportDateTo&&o.date>reportDateTo)return false;}
      return true;
    });
    const rptProduced=reportOrders.reduce((s,o)=>s+o.producedTons,0);
    const rptTarget=reportOrders.reduce((s,o)=>s+o.targetTons,0);
    const rptActive=reportOrders.filter(o=>o.status==="in-progress").length;
    const rptPaused=reportOrders.filter(o=>o.status==="paused").length;
    const rptPending=reportOrders.filter(o=>o.status==="pending").length;
    const rptDone=reportOrders.filter(o=>o.status==="completed").length;
    const rptMins=calcUnionWorkMins(reportOrders);
    const rptCrit=inventory.filter(i=>i.alertLevel==="critical");
    const rptWarn=inventory.filter(i=>i.alertLevel==="warning");
    const allSubs=substitutionAlerts.flatMap(a=>a.suggestions);
    const rptName=t("تقرير الإنتاج","Production Report");
    const todayStr=new Date().toLocaleDateString("ar-EG",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

    const periodLabel=reportDateMode==="all"?t("جميع الأوامر","All Orders"):reportDateMode==="today"?t("اليوم فقط","Today Only"):reportDateMode==="range"?`${t("من","From")} ${reportDateFrom||"..."} ${t("إلى","to")} ${reportDateTo||"..."}`:"";

    const styles=`
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
      .section p{font-size:12px;margin:4px 0}
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
      .badge-default{background:#f1f5f9;color:#475569}
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
      .summary-row{display:flex;gap:10px;margin-bottom:4px}
      .summary-row p{flex:1;margin:0}
    `;

    const content=`
      <div class="watermark">${companyName}</div>
      <div class="header">
        <div class="header-right">
          <h1>${rptName}</h1>
          <p class="sub">${periodLabel}</p>
        </div>
        <div class="header-left">
          ${companyLogo?`<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>`:""}
          <div class="company">${companyName||"تاج"}</div>
          ${companyAddress?`<div>${companyAddress}</div>`:""}
          <div style="margin-top:2px">${t("تاريخ الإنشاء","Generated")}: ${todayStr}</div>
        </div>
      </div>
      <div class="meta">
        <span>📋 ${reportOrders.length} ${t("أمر","order(s)")}</span>
        <span>🏭 ${t("قسم الإنتاج","Production Department")}</span>
      </div>
      ${reportSummary?`
      <div class="section">
        <h2>${t("ملخص الأوامر","Orders Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num" style="color:#1d4ed8">${reportOrders.length}</div><div class="lbl">${t("إجمالي الأوامر","Total Orders")}</div></div>
          <div class="card"><div class="num" style="color:#1d4ed8">${rptProduced}<span style="font-size:12px;font-weight:400">/${rptTarget}</span></div><div class="lbl">${t("أطنان","Tons")}</div></div>
          <div class="card"><div class="num" style="color:#1d4ed8">${fmtMins(rptMins)}</div><div class="lbl">${t("وقت العمل","Work Time")}</div></div>
        </div>
        <div class="grid" style="margin-top:6px">
          <div class="card" style="border-color:#93c5fd"><div class="num" style="color:#1d4ed8">${rptActive}</div><div class="lbl">${t("جاري","Active")}</div></div>
          <div class="card" style="border-color:#fcd34d"><div class="num" style="color:#b45309">${rptPaused}</div><div class="lbl">${t("موقوف","Paused")}</div></div>
          <div class="card" style="border-color:#fde68a"><div class="num" style="color:#a16207">${rptPending}</div><div class="lbl">${t("انتظار","Pending")}</div></div>
          <div class="card" style="border-color:#86efac"><div class="num" style="color:#15803d">${rptDone}</div><div class="lbl">${t("مكتمل","Done")}</div></div>
        </div>
      </div>`:""}
      ${reportShortages&&(rptCrit.length>0||rptWarn.length>0)?`
      <div class="section">
        <h2>${t("النواقص والمواد الحرجة","Shortages & Critical Materials")}</h2>
        ${rptCrit.length>0?`
        <table>
          <tr><th>${t("المادة","Material")}</th><th>${t("المخزون المتبقي","Remaining")}</th><th>${t("الحالة","Status")}</th></tr>
          ${rptCrit.map(i=>`<tr><td><strong>${i.materialName}</strong></td><td>${i.quantity}${i.unit==="ton"?t("ط","T"):t("ك","kg")}</td><td><span class="badge badge-red">${t("ناقص حرج","Critical")}</span></td></tr>`).join("")}
        </table>`:""}
        ${rptWarn.length>0?`
        <table>
          <tr><th>${t("المادة","Material")}</th><th>${t("المخزون المتبقي","Remaining")}</th><th>${t("الحالة","Status")}</th></tr>
          ${rptWarn.map(i=>`<tr><td>${i.materialName}</td><td>${i.quantity}${i.unit==="ton"?t("ط","T"):t("ك","kg")}</td><td><span class="badge badge-amber">${t("تحذير","Warning")}</span></td></tr>`).join("")}
        </table>`:""}
      </div>`:""}
      ${reportSubstitutions&&allSubs.length>0?`
      <div class="section">
        <h2>${t("الاستبدالات والفرق السعري","Substitutions & Price Differences")}</h2>
        <table>
          <tr><th>${t("المادة الأصلية","Original")}</th><th>${t("البديل","Substitute")}</th><th>${t("السعر الأصلي","Orig.")}</th><th>${t("سعر البديل","Sub.")}</th><th>${t("الفرق","Diff.")}</th></tr>
          ${allSubs.map(s=>{const diff=s.substitutePricePerTon-s.originalPricePerTon;return `<tr><td>${s.originalMaterial}</td><td><strong>${s.substituteMaterial}</strong></td><td>${formatter.format(s.originalPricePerTon)}</td><td>${formatter.format(s.substitutePricePerTon)}</td><td style="color:${diff>0?'#dc2626':'#15803d'};font-weight:600">${diff>0?'+':''}${formatter.format(diff)}</td></tr>`;}).join("")}
        </table>
        <div class="summary-row" style="margin-top:8px;padding:8px 10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
          <p><strong>${t("إجمالي فرق السعر","Total Price Difference")}:</strong>
            <span style="color:${allSubs.reduce((s,x)=>s+(x.substitutePricePerTon-x.originalPricePerTon),0)>0?'#dc2626':'#15803d'};font-weight:700;font-size:14px">
            ${allSubs.reduce((s,x)=>s+(x.substitutePricePerTon-x.originalPricePerTon),0)>0?'+':''}${formatter.format(allSubs.reduce((s,x)=>s+(x.substitutePricePerTon-x.originalPricePerTon),0))} ${t("ج.م/ط","EGP/T")}
          </span></p>
        </div>
      </div>`:""}
      ${reportOrderList&&reportOrders.length>0?`
      <div class="section">
        <h2>${t("قائمة الأوامر","Order List")} (${reportOrders.length})</h2>
        <table>
          <tr><th>${t("الكود","ID")}</th><th>${t("المنتج","Product")}</th><th>${t("التاريخ","Date")}</th><th>${t("الحالة","Status")}</th><th>${t("الكمية","Qty")} (${t("ط","T")})</th><th>${t("الشكاير","Bags")}</th></tr>
          ${reportOrders.map(o=>{const st={pending:t("انتظار","Pending"),"in-progress":t("جاري","Active"),paused:t("موقوف","Paused"),completed:t("مكتمل","Done")}[o.status];const totalBags=bagsTotal(o.bags);return `<tr><td style="font-weight:600">${o.id}</td><td>${o.productName}</td><td>${o.date}</td><td><span class="badge ${o.status==='completed'?'badge-green':o.status==='in-progress'?'badge-blue':o.status==='paused'?'badge-amber':'badge-default'}">${st}</span></td><td>${o.producedTons}/${o.targetTons}</td><td>${totalBags>0?fmtNum(totalBags):"—"}</td></tr>`;}).join("")}
        </table>
      </div>`:""}
      <div class="footer">
        <p><span class="footer-logo">${companyName||"تاج"}</span> — ${t("جميع الحقوق محفوظة","All rights reserved")} © ${new Date().getFullYear()}</p>
        <p style="margin-top:2px">${t("تم إنشاؤه بواسطة","Generated by")} تاج — ${todayStr}</p>
      </div>
    `;

    const html=`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${rptName}</title><style>${styles}</style></head><body>${content}</body></html>`;
    const win=window.open("","_blank");
    if(win){win.document.write(html);win.document.close();win.focus();setTimeout(()=>{win.print();},500);}
  };
  const statusFilters:[{value:FilterStatus;label_ar:string;count:number}]=[
    {value:"all",label_ar:"الكل",count:orders.length},{value:"in-progress",label_ar:"جاري",count:counts["in-progress"]},
    {value:"paused",label_ar:"موقوف",count:counts.paused},{value:"pending",label_ar:"انتظار",count:counts.pending},{value:"completed",label_ar:"مكتمل",count:counts.completed},
  ] as any;

  return(
    <div className="space-y-4 sm:space-y-5">

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-4 sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent pointer-events-none"/>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Factory className="w-5 h-5 text-primary"/></div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t("الإنتاج","Production")}</h1>
              {counts["in-progress"]>0&&<span className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2 sm:px-2.5 py-1 rounded-full whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"/>{counts["in-progress"]} {t("جاري","active")}</span>}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("إدارة أوامر التشغيل · التركيبات · المخزون","Manage orders · Formulas · Inventory")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {activeTab==="orders"&&<>
              <Button variant="outline" className="gap-2 rounded-xl" onClick={()=>{setReportOpen(true);setReportGenerated(false);setReportGenerating(false);}}>
                <BarChart3 className="w-4 h-4"/>{t("تقرير","Report")}
              </Button>
              <Button className="gap-2 rounded-xl" onClick={()=>setSheetOpen(true)}><Plus className="w-4 h-4"/>{t("أمر جديد","New Order")}</Button>
            </>}
          </div>
        </div>
        <div className="mt-4 sm:mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            {icon:<TrendingUp className="w-3.5 h-3.5"/>,label:t("إجمالي الإنتاج","Total Produced"),val:`${totalProduced} / ${totalTarget} ${t("ط","T")}`,big:`${totalProduced} / ${totalTarget}`,sub:t("ط","T"),onClick:undefined},
            {icon:<Timer className="w-3.5 h-3.5"/>,label:t("وقت العمل الفعلي","Factory Time"),val:fmtMins(totalWorkedMins),big:String(totalWorkedMins),sub:t("دقيقة","min"),onClick:()=>{}},
            {icon:<PackageCheck className="w-3.5 h-3.5"/>,label:t("إجمالي الشكاير","Total Bags"),val:totalBagsAll>0?fmtNum(totalBagsAll):"—",big:fmtNum(totalBagsAll),sub:t("شيكارة","bag"),onClick:()=>{}},
            {icon:<Layers className="w-3.5 h-3.5"/>,label:t("عدد الأوامر","Orders"),val:String(filtered.length),big:String(filtered.length),sub:t("أمر","order"),onClick:undefined},
          ].map(k=>{
            const isBags = k.label.includes("Bags")||k.label.includes("الشكاير");
            const isWork = k.label.includes("Factory")||k.label.includes("العمل");
            const isClickable = !!k.onClick;
            const loading = isBags && bagsLoading;
            const popoverVisible = (isBags && showBagsPopover) || (isWork && showWorkPopover);
            const setPopover = isBags ? setShowBagsPopover : setShowWorkPopover;
            const inner=(
              <div className={`relative rounded-xl backdrop-blur-sm border px-2.5 sm:px-3.5 py-2.5 sm:py-3 transition-all duration-500 overflow-hidden ${loading?"bg-primary/10 border-primary/30 shadow-[0_0_20px_-5px] shadow-primary/20":"bg-background/60 border-border/60"}`}>
                {loading&&<div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full animate-shimmer"/>}
                <div className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground mb-0.5 sm:mb-1">
                  <span className={`shrink-0 transition-colors duration-500 ${loading?"text-primary":"text-primary/70"}`}>{k.icon}</span>
                  <span className="text-[10px] sm:text-xs leading-tight">{k.label}</span>
                </div>
                {loading ? (
                  <div className="flex items-center gap-1.5">
                    <span className="h-4 w-16 rounded bg-primary/20 animate-pulse"/>
                    <span className="h-3 w-8 rounded bg-primary/10 animate-pulse"/>
                  </div>
                ) : (
                  <div className="font-bold text-xs sm:text-sm">
                    <MagItem label={k.val} detail={k.label} big={k.big} sub={k.sub} className="inline-flex">{k.val}</MagItem>
                  </div>
                )}
              </div>
            );
            return isClickable ? (
              <div key={k.label} className="relative"
                onMouseEnter={()=>setPopover(true)}
                onMouseLeave={()=>setPopover(false)}
              >
                <button type="button" onClick={k.onClick}
                  className="text-start hover:scale-[1.02] active:scale-[0.98] transition-transform w-full">{inner}</button>
                <AnimatePresence>
                  {popoverVisible && (isBags ? (
                    <motion.div
                      initial={{opacity:0,scale:0.85,y:6,rotateX:-8}}
                      animate={{opacity:1,scale:1,y:0,rotateX:0}}
                      exit={{opacity:0,scale:0.9,y:-4,rotateX:-4}}
                      transition={{type:"spring",stiffness:350,damping:22,mass:0.9}}
                      className="absolute top-full start-0 mt-1.5 w-60 z-50 rounded-2xl border-0 overflow-hidden backdrop-blur-xl bg-card/95"
                      style={{perspective:"800px",transformStyle:"preserve-3d",boxShadow:"0 25px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset"}}
                      onMouseEnter={()=>setShowBagsPopover(true)}
                      onMouseLeave={()=>setShowBagsPopover(false)}
                    >
                      {/* ── Header ── */}
                      <div className="relative overflow-hidden px-4 py-3.5 bg-gradient-to-br from-primary/25 via-primary/10 to-background">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent pointer-events-none"/>
                        <div className="absolute -top-6 -end-6 w-20 h-20 rounded-full bg-primary/10 blur-2xl pointer-events-none"/>
                        <div className="flex items-center justify-between relative">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center backdrop-blur-sm">
                              <PackageCheck className="w-4 h-4 text-primary"/>
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{t("تفاصيل الشكاير","Bags Breakdown")}</p>
                              <p className="text-[10px] text-muted-foreground">{t("توزيع الأوزان","Weight distribution")}</p>
                            </div>
                          </div>
                          <motion.div
                            initial={{scale:0,rotate:-180}}
                            animate={{scale:1,rotate:0}}
                            transition={{type:"spring",stiffness:250,damping:14,delay:0.08}}
                            className="text-end"
                          >
                            <p className="text-lg font-black text-primary leading-none">{fmtNum(totalBagsAll)}</p>
                            <p className="text-[9px] text-muted-foreground leading-tight">{t("شيكارة","bag")}</p>
                          </motion.div>
                        </div>
                      </div>

                      {/* ── Bag items ── */}
                      <div className="p-3 space-y-2">
                        {globalAggBags.map((b,i)=>{
                          const pct=totalBagsAll>0?(b.count/totalBagsAll)*100:0;
                          const tons=(b.count*b.weightKg)/1000;
                          const hues=["220","160","280","40","350"];
                          const hue=hues[i%5];
                          return(
                            <motion.div
                              key={b.id}
                              initial={{opacity:0,x:-16,scale:0.95}}
                              animate={{opacity:1,x:0,scale:1}}
                              transition={{type:"spring",stiffness:300,damping:22,delay:0.04*i+0.06}}
                              className="group relative overflow-hidden rounded-xl border border-border/40 hover:border-border/80 transition-all duration-300"
                              style={{background:`linear-gradient(135deg, hsl(${hue},60%,60%,0.06) 0%, transparent 100%)`}}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:via-transparent group-hover:to-white/5 transition-all duration-500 pointer-events-none"/>
                              <div className="relative px-3 py-2.5">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur-sm transition-transform duration-300 group-hover:scale-110"
                                      style={{background:`hsl(${hue},60%,50%,0.12)`,color:`hsl(${hue},70%,50%)`}}>
                                      <Package className="w-3.5 h-3.5"/>
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold leading-tight">
                                        <MagItem
                                          label={`${b.weightKg} ${t("كجم","kg")}`}
                                          detail={t("وزن الشيكارة","Bag Weight")}
                                          big={`${b.weightKg}`}
                                          sub="kg"
                                          className="inline-flex"
                                        >
                                          {b.weightKg}
                                          <span className="text-[10px] font-medium text-muted-foreground">{t("كجم","kg")}</span>
                                        </MagItem>
                                      </p>
                                      <p className="text-[10px] text-muted-foreground leading-tight">
                                        <MagItem
                                          label={`${fmtNum(b.count)} ${t("شيكارة","bags")}`}
                                          detail={t("عدد الشكاير","Bag Count")}
                                          big={`${fmtNum(b.count)}`}
                                          sub={t("شيكارة","bags")}
                                          className="inline-flex"
                                        >
                                          {fmtNum(b.count)}
                                          {" "}{t("شيكارة","bags")}
                                        </MagItem>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-end">
                                    <motion.p
                                      initial={{opacity:0,y:8,scale:0.8}}
                                      animate={{opacity:1,y:0,scale:1}}
                                      transition={{type:"spring",stiffness:300,damping:18,delay:0.08+i*0.04}}
                                      className="text-sm font-black leading-tight"
                                      style={{color:`hsl(${hue},70%,50%)`}}
                                    >{pct.toFixed(0)}<span className="text-[10px]">%</span></motion.p>
                                    <p className="text-[10px] text-muted-foreground font-mono leading-tight">
                                      <MagItem
                                        label={`${tons.toFixed(1)} ${t("ط","T")}`}
                                        detail={t("الوزن بالطن","Weight in Tons")}
                                        big={tons.toFixed(1)}
                                        sub={t("ط","T")}
                                        className="inline-flex"
                                      >{tons.toFixed(1)}{t("ط","T")}</MagItem>
                                    </p>
                                  </div>
                                </div>
                                {/* ── Animated progress bar ── */}
                                <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                                  <motion.div
                                    initial={{width:0}}
                                    animate={{width:`${pct}%`}}
                                    transition={{duration:0.7,delay:0.12+i*0.04,ease:"easeOut"}}
                                    className="h-full rounded-full"
                                    style={{background:`linear-gradient(90deg, hsl(${hue},60%,50%,0.5), hsl(${hue},70%,55%))`}}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* ── Footer ── */}
                      <motion.div
                        initial={{opacity:0,y:6}}
                        animate={{opacity:1,y:0}}
                        transition={{type:"spring",stiffness:200,damping:18,delay:0.25}}
                        className="mx-3 mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t("إجمالي الأوزان","Total Weight")}</span>
                          <span className="text-xs font-bold">
                            <MagItem
                              label={`${fmtNum(totalBagsAll)} ${t("شيكارة","bags")}`}
                              detail={t("إجمالي الشكاير","Total Bags")}
                              big={`${fmtNum(totalBagsAll)}`}
                              sub={t("شيكارة","bags")}
                              className="inline-flex"
                            >
                              {fmtNum(totalBagsAll)}
                              {" "}{t("شيكارة","bags")}
                            </MagItem>
                            <span className="text-muted-foreground font-mono ms-1.5">
                              (<MagItem
                                label={`${(globalAggBags.reduce((s,b)=>s+b.count*b.weightKg,0)/1000).toFixed(1)} ${t("ط","T")}`}
                                detail={t("الوزن الإجمالي","Total Weight")}
                                big={(globalAggBags.reduce((s,b)=>s+b.count*b.weightKg,0)/1000).toFixed(1)}
                                sub={t("ط","T")}
                                className="inline-flex"
                              >{(globalAggBags.reduce((s,b)=>s+b.count*b.weightKg,0)/1000).toFixed(1)}{t("ط","T")}</MagItem>)
                            </span>
                          </span>
                        </div>
                      </motion.div>
                    </motion.div>
                    ) : (
                    <motion.div
                      initial={{opacity:0,scale:0.85,y:6,rotateX:-8}}
                      animate={{opacity:1,scale:1,y:0,rotateX:0}}
                      exit={{opacity:0,scale:0.9,y:-4,rotateX:-4}}
                      transition={{type:"spring",stiffness:350,damping:22,mass:0.9}}
                      className="absolute top-full start-0 mt-1.5 w-full min-w-[300px] z-50 rounded-2xl border-0 overflow-hidden backdrop-blur-xl bg-card/95"
                      style={{perspective:"800px",transformStyle:"preserve-3d",boxShadow:"0 25px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset"}}
                      onMouseEnter={()=>setShowWorkPopover(true)}
                      onMouseLeave={()=>setShowWorkPopover(false)}
                    >
                      <div className="relative overflow-hidden px-4 py-3.5 bg-gradient-to-br from-amber-500/25 via-amber-500/10 to-background">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent pointer-events-none"/>
                        <div className="absolute -top-6 -end-6 w-20 h-20 rounded-full bg-amber-500/10 blur-2xl pointer-events-none"/>
                        <div className="flex items-center justify-between relative">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center backdrop-blur-sm">
                              <Timer className="w-4 h-4 text-amber-500"/>
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{t("تفاصيل وقت العمل","Work Time Breakdown")}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {dateMode==="today" ? t("اليوم","Today")
                                : dateMode==="range" ? `${t("من","From")} ${dateFrom||"..."} ${t("إلى","to")} ${dateTo||"..."}`
                                : t("الكل","All")}
                              </p>
                            </div>
                          </div>
                          <motion.div
                            initial={{scale:0,rotate:-180}}
                            animate={{scale:1,rotate:0}}
                            transition={{type:"spring",stiffness:250,damping:14,delay:0.08}}
                            className="text-end"
                          >
                            <p className="text-lg font-black text-amber-500 leading-none">{fmtMins(totalWorkedMins)}</p>
                            <p className="text-[9px] text-muted-foreground leading-tight">{t("إجمالي","total")}</p>
                          </motion.div>
                        </div>
                      </div>
                      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                        {filtered.length===0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">{t("لا يوجد أوامر","No orders")}</p>
                        ) : filtered.map((order,oi)=>{
                          const wm=getCardWork(order);
                          const pct=totalWorkedMins>0?(wm/totalWorkedMins)*100:0;
                          return wm>0?(
                            <motion.div key={order.id}
                              initial={{opacity:0,x:-16,scale:0.95}}
                              animate={{opacity:1,x:0,scale:1}}
                              transition={{type:"spring",stiffness:300,damping:22,delay:0.04*oi+0.06}}
                              className="group relative overflow-hidden rounded-xl border border-border/40 hover:border-border/80 transition-all duration-300"
                            >
                              <div className="relative px-3 py-2.5 min-h-[52px]">
                                <div className="flex items-start gap-2 mb-1">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold leading-tight truncate text-foreground/90">{order.productName}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{order.id}</p>
                                  </div>
                                  <span className="text-xs font-bold shrink-0 mt-0.5"><MagItem label={`${Math.floor(wm/60)}h ${wm%60}m`} detail={t("وقت العمل","Work time")} big={String(wm)} sub={t("دقيقة","min")} className="whitespace-nowrap">{Math.floor(wm/60)}h {wm%60}m</MagItem></span>
                                </div>
                                <div className="w-full h-1 rounded-full bg-muted/50 overflow-hidden">
                                  <motion.div
                                    initial={{width:0}}
                                    animate={{width:`${pct}%`}}
                                    transition={{duration:0.7,delay:0.1+oi*0.04,ease:"easeOut"}}
                                    className="h-full rounded-full bg-gradient-to-r from-amber-500/50 to-amber-500"
                                  />
                                </div>
                              </div>
                            </motion.div>
                          ):null;
                        })}
                      </div>
                    </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            ):(
              <div key={k.label}>{inner}</div>
            );
          })}
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 p-1 bg-muted/40 border border-border/50 rounded-xl max-w-full overflow-x-auto flex-nowrap">
        {([
          {id:"orders" as PageTab,label:t("أوامر الإنتاج","Production Orders"),icon:<Factory className="w-3.5 h-3.5"/>},
          {id:"formulas" as PageTab,label:t("التركيبات","Formulas"),icon:<FlaskConical className="w-3.5 h-3.5"/>},
        ]).map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab===tab.id?"bg-background shadow text-foreground":"text-muted-foreground hover:text-foreground"}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── Formulas Tab ── */}
      {activeTab==="formulas"&&(
        <FormulasTab products={products} formulas={formulas} inventory={inventory} updateFormula={updateFormula} deleteFormula={deleteFormula} warehouseConfigs={warehouseConfigs} t={t}/>
      )}

      {/* ── Orders Tab ── */}
      {activeTab==="orders"&&(<>
        {/* Filter Bar */}
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground me-1 shrink-0"><CalendarDays className="w-3.5 h-3.5"/>{t("تاريخ:","Date:")}</div>
            {([{mode:"all" as DateMode,label:t("الكل","All")},{mode:"today" as DateMode,label:t("اليوم","Today")},{mode:"range" as DateMode,label:t("نطاق","Range")}]).map(d=>(
              <button key={d.mode} onClick={()=>{setDateMode(d.mode);if(d.mode!=="range"){setDateFrom("");setDateTo("");}}}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${dateMode===d.mode?"bg-primary text-primary-foreground shadow-sm":"bg-muted/60 text-muted-foreground hover:bg-muted"}`}>{d.label}</button>
            ))}
            {dateMode==="range"&&<div className="flex items-center gap-1.5 flex-wrap"><Input type="date" className="h-7 text-xs w-28 sm:w-36 rounded-lg" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/><span className="text-muted-foreground text-xs">→</span><Input type="date" className="h-7 text-xs w-28 sm:w-36 rounded-lg" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>{(dateFrom||dateTo)&&<button onClick={clearDateFilter} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5"/></button>}</div>}
            {dateMode==="today"&&<span className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1 font-mono">{fmtDate(nowDate())}</span>}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground me-1 shrink-0">{t("الحالة:","Status:")}</span>
            {statusFilters.map((f:any)=>(
              <button key={f.value} onClick={()=>setFilterStatus(f.value)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filterStatus===f.value?"bg-primary text-primary-foreground border-primary shadow-sm":"bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"}`}>
                {f.label_ar}<span className={`min-w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1 ${filterStatus===f.value?"bg-white/20":"bg-muted-foreground/10"}`}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {([
            {status:"in-progress" as OrderStatus,label:t("جاري","Active"), color:"text-primary",    bg:"bg-primary/8 dark:bg-primary/15",    dot:"bg-primary animate-pulse"},
            {status:"paused"      as OrderStatus,label:t("موقوف","Paused"),color:"text-orange-500", bg:"bg-orange-50 dark:bg-orange-950/30", dot:"bg-orange-400"},
            {status:"pending"     as OrderStatus,label:t("انتظار","Pending"),color:"text-amber-600",bg:"bg-amber-50 dark:bg-amber-950/30",   dot:"bg-amber-400"},
            {status:"completed"   as OrderStatus,label:t("مكتمل","Done"),  color:"text-emerald-600",bg:"bg-emerald-50 dark:bg-emerald-950/30",dot:"bg-emerald-500"},
          ]).map(s=>(
            <button key={s.status} onClick={()=>setFilterStatus(s.status)}
              className={`rounded-xl ${s.bg} px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 text-start transition-all hover:opacity-90 ${filterStatus===s.status?"ring-2 ring-primary/30 ring-offset-1":""}`}>
              <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${s.dot} shrink-0`}/>
              <div><p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{counts[s.status]}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p></div>
            </button>
          ))}
        </div>

        {/* ── Smart Substitution Suggestions ── */}
        {substitutionAlerts.length > 0 && (
          <SubstitutionSuggestionsPanel
            alerts={substitutionAlerts}
            accepted={suggAccepted}
            rejected={suggRejected}
            onApprove={handleSuggApprove}
            onReject={handleSuggReject}
            t={t}
          />
        )}

        {/* Cards */}
        <div>
          {filtered.length===0?(
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-14 text-center">
              <BarChart3 className="w-9 h-9 mx-auto mb-3 text-muted-foreground/30"/>
              <p className="text-sm text-muted-foreground">{t("لا توجد أوامر تطابق الفلتر","No orders match the filter")}</p>
              <button className="mt-2 text-xs text-primary hover:underline" onClick={()=>{setFilterStatus("all");clearDateFilter();}}>{t("مسح الفلاتر","Clear filters")}</button>
            </div>
          ):(
            <div className="flex flex-col gap-3 sm:gap-4">
              <AnimatePresence>
                {filtered.map((order,idx)=>(
                  <OrderCard key={order.id} order={order} cardIndex={idx} onStop={handleStop}
                    onResumeClick={o=>{setResumeTarget(o);setResumeOpen(true);}} onCompleteClick={handleCompleteClick}
                    onDelete={handleDelete} onEdit={handleEdit} t={t}
                    onBagsClick={o=>{setBagsDialogOrder(o);setBagsDialogOpen(true);}}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </>)}

      {/* ── Dialogs & Sheets ── */}
      <BagConfirmDialog open={bagOpen} order={bagTarget} onConfirm={handleBagConfirm} onCancel={()=>{setBagOpen(false);setBagTarget(null);}} t={t}/>
      <ResumeDialog open={resumeOpen} order={resumeTarget} onConfirm={handleResumeConfirm} onCancel={()=>{setResumeOpen(false);setResumeTarget(null);}} t={t}/>

      {/* Bags Breakdown Dialog */}
      <BagsBreakdownDialog
        open={bagsDialogOpen}
        bags={bagsDialogOrder?.bags||[]}
        productName={bagsDialogOrder?.productName||""}
        producedTons={bagsDialogOrder?.producedTons||0}
        onClose={()=>{setBagsDialogOpen(false);setBagsDialogOrder(null);}}
        t={t}
      />

      {/* New Order Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <div className="bg-gradient-to-b from-primary/[0.04] to-transparent -mx-6 -mt-6 px-6 pt-6 pb-4 mb-5 rounded-t-2xl">
            <SheetHeader><SheetTitle className="flex items-center gap-2 text-lg"><Factory className="w-5 h-5 text-primary"/>{t("أمر إنتاج جديد","New Production Order")}</SheetTitle><SheetDescription>{t("حدد المنتج والكمية","Select product and quantity")}</SheetDescription></SheetHeader>
          </div>

          <div className="space-y-5">
            {/* ── Product ── */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-primary"/></div>
              <div className="flex-1">
                <SmartInput field="product-name"
                  value={productSearch}
                  onChange={v=>{setProductSearch(v);const p=products.find(pr=>pr.name===v);if(p){setSelProductId(p.id);setFormBagWeight(p.bagWeight||50);setFormBagCount("");setTargetTons("");}else if(!v){setSelProductId("");}}}
                  extraSuggestions={[...products.map(p=>p.name), ...getFeedTermSuggestions()]}
                  placeholder={t("اختر المنتج...","Select product...")}
                  className="h-9 text-sm"
                />
              </div>
              {selProduct&&<span className="text-[11px] font-bold text-primary whitespace-nowrap">{fmtNum(selProduct.wholeSalePrice)}<span className="text-[9px] text-muted-foreground mr-0.5">{t("ج.م","EGP")}</span></span>}
            </div>

            {/* ── Bags (inline) ── */}
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] text-muted-foreground font-medium">{t("الوزن:","Wt:")}</span>
                {[25,50,100].map(w=>(
                  <motion.button key={w} type="button" layout whileHover={{y:-1}} whileTap={{scale:0.95}}
                    transition={{type:"spring",stiffness:300,damping:24}}
                    onClick={()=>{setFormBagWeight(w);const t=parseFloat(targetTons)||0;if(t>0)setFormBagCount(String(Math.round((t*1000)/w)));}}
                    className={`relative px-2.5 py-1 rounded-md text-xs font-semibold ${formBagWeight===w?"bg-primary text-primary-foreground shadow-sm":"bg-background text-muted-foreground hover:text-foreground border"}`}>
                    {formBagWeight===w&&<motion.div layoutId="bw" className="absolute inset-0 rounded-md bg-primary"/>}
                    <span className="relative z-[1]">{w}</span>
                  </motion.button>
                ))}
                <Input type="number" min="1" className="h-7 w-14 text-xs text-center" placeholder={t("وزن","Wt")}
                  value={[25,50,100].includes(formBagWeight)?"":formBagWeight}
                  onChange={e=>{const w=parseInt(e.target.value)||50;setFormBagWeight(w>0?w:50);const t=parseFloat(targetTons)||0;if(t>0)setFormBagCount(String(Math.round((t*1000)/w)));}}
                  style={{minWidth:"5rem",height:"1.6rem"}}/>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-center">
                <div className="relative">
                  <Input type="number" min="0" step="0.001" className="h-8 text-sm font-bold text-primary text-center" placeholder={t("الطن","Tons")} value={targetTons}
                    onChange={e=>{setTargetTons(e.target.value);const t=parseFloat(e.target.value)||0;if(t>0&&formBagWeight>0)setFormBagCount(String(Math.round((t*1000)/formBagWeight)));else setFormBagCount("");}}/>
                  {targetTons&&parseFloat(targetTons)>0&&<span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/30 font-bold">T</span>}
                </div>
                <motion.div animate={{rotate:formBagCount&&targetTons?180:0}} transition={{type:"spring",stiffness:200}} className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-2.5 h-2.5 text-primary"/>
                </motion.div>
                <Input type="number" min="0" className="h-8 text-sm font-semibold text-center" placeholder={t("العدد","Count")} value={formBagCount}
                  onChange={e=>{const c=parseInt(e.target.value)||0;setFormBagCount(e.target.value);if(c>0&&formBagWeight>0)setTargetTons(String((c*formBagWeight)/1000));else if(c===0)setTargetTons("");}}/>
              </div>
              <AnimatePresence mode="wait">
                {formBagCount&&parseFloat(formBagCount)>0&&formBagWeight>0&&(
                  <motion.div key="s" initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}
                    className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
                    <span>{fmtNum(parseFloat(formBagCount))} {t("شيكارة","bags")}</span>
                    <span>{((parseFloat(formBagCount)*formBagWeight)/1000).toFixed(2)} {t("طن","T")}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Time + Warehouse (inline) ── */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 bg-muted/15 rounded-lg border border-border/30 px-2 py-1.5">
                <Clock className="w-3 h-3 text-muted-foreground/50 shrink-0"/>
                <Input type="time" className="h-7 text-xs border-0 bg-transparent p-0" value={newStart} onChange={e=>setNewStart(e.target.value)}/>
              </div>
              <span className="text-[10px] text-muted-foreground/40">{t("إلى","to")}</span>
              <div className="flex-1 flex items-center gap-1 bg-muted/15 rounded-lg border border-border/30 px-2 py-1.5">
                <Timer className="w-3 h-3 text-muted-foreground/50 shrink-0"/>
                <Input type="time" className="h-7 text-xs border-0 bg-transparent p-0" value={newEnd} onChange={e=>setNewEnd(e.target.value)}/>
              </div>
              <div className="flex-[1.5] flex items-center gap-1 bg-muted/15 rounded-lg border border-border/30 px-2 py-1.5">
                <Store className="w-3 h-3 text-muted-foreground/50 shrink-0"/>
                <Select value={newWarehouse} onValueChange={setNewWarehouse}>
                  <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 shadow-none [&>span]:truncate"><SelectValue placeholder={t("مخزن","Store")}/></SelectTrigger>
                  <SelectContent>
                    {warehouseConfigs.map(w=>{
                      const info=warehouseAvail.get(w.id);const show=info&&info.total>0;
                      return <SelectItem key={w.id} value={w.id}><span className="flex items-center gap-2"><span>{w.name}</span>{show&&<span className={`text-[9px] px-1 py-0.5 rounded-full font-medium ${info!.available===info!.total?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{info!.available}/{info!.total}</span>}</span></SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newStart&&newEnd&&(()=>{const d=calcDurationMins(newStart,newEnd);return d>0?<p className="text-[9px] text-muted-foreground/50 text-center -mt-2">{t("المدة","Duration")}: {fmtMins(d)}</p>:null;})()}

            {/* ── AI Analysis ── */}
            <motion.button type="button" whileHover={{scale:1.02}} whileTap={{scale:0.98}}
              onClick={handleAiAnalyze} disabled={!selProductId||!targetTons||aiAnalyzing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 text-primary hover:from-primary/10 hover:to-primary/15 disabled:opacity-40 transition-all">
              {aiAnalyzing?<>
                <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"/>
                {t("AI جارٍ التحليل...","AI Analyzing...")}
              </>:<>
                <Brain className="w-4 h-4"/>
                {t("AI تحليل المخزون والبدائل","AI Inventory Analysis")}
              </>}
            </motion.button>

            {/* ── AI Suggestion Results ── */}
            {aiSuggestionResult && aiSuggestionResult.suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden"
              >
                {/* Summary */}
                <div className="p-3 border-b border-amber-200/60 dark:border-amber-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-amber-600" />
                      {t("المواد المطلوب استبدالها", "Materials to substitute")}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 font-medium">
                      {aiSuggestionResult.suggestions.length} {t("مواد", "items")}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-background/60 px-2 py-1.5">
                      <p className="text-[10px] text-muted-foreground">{t("التكلفة الحالية", "Current")}</p>
                      <p className="text-sm font-bold">{currencyFmt(aiSuggestionResult.totalOriginalCost)}</p>
                    </div>
                    <div className="rounded-lg bg-background/60 px-2 py-1.5">
                      <p className="text-[10px] text-muted-foreground">{t("التكلفة الجديدة", "New")}</p>
                      <p className={`text-sm font-bold ${aiSuggestionResult.totalImpact <= 0 ? "text-emerald-600" : "text-amber-600"}`}>{currencyFmt(aiSuggestionResult.totalNewCost)}</p>
                    </div>
                    <div className={`rounded-lg px-2 py-1.5 ${aiSuggestionResult.totalImpact > 0 ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"}`}>
                      <p className={`text-[10px] ${aiSuggestionResult.totalImpact > 0 ? "text-red-600" : "text-emerald-600"}`}>{aiSuggestionResult.totalImpact > 0 ? t("زيادة", "Increase") : t("توفير", "Saving")}</p>
                      <p className={`text-sm font-bold ${aiSuggestionResult.totalImpact > 0 ? "text-red-600" : "text-emerald-600"}`}>{aiSuggestionResult.totalImpact > 0 ? "+" : ""}{currencyFmt(aiSuggestionResult.totalImpact)}</p>
                    </div>
                  </div>
                </div>
                {/* Suggestions */}
                <div className="divide-y divide-amber-200/40 dark:divide-amber-800/30">
                  {aiSuggestionResult.suggestions.map((s, idx) => {
                    const key = `${aiSuggestionResult.orderId}|${s.originalMaterial}│${s.substituteMaterial}`;
                    const isAccepted = suggAccepted.has(key);
                    const isRejected = suggRejected.has(key);
                    const diff = s.substitutePricePerTon - s.originalPricePerTon;
                    return (
                      <div key={key} className={`p-3 transition-colors ${isAccepted ? "bg-emerald-50/50 dark:bg-emerald-950/20" : isRejected ? "bg-destructive/5" : ""}`}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 sm:gap-x-3 gap-y-1.5 text-xs mb-2">
                          <div>
                            <span className="text-[10px] text-muted-foreground/60">{t("المادة الأصلية", "Original")}</span>
                            <p className="font-semibold truncate">{s.originalMaterial}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground/60">{t("البديل", "Substitute")}</span>
                            <p className="font-semibold truncate text-primary">{s.substituteMaterial}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground/60">{t("السعر", "Price")}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-muted-foreground line-through">{formatter.format(s.originalPricePerTon)}</span>
                              <span className="font-medium">{formatter.format(s.substitutePricePerTon)}</span>
                              <span className={`text-[10px] font-bold ${diff > 0 ? "text-destructive" : "text-emerald-600"}`}>
                                {diff > 0 ? "+" : ""}{formatter.format(diff)} {t("ج.م.", "EGP")}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground/60">{t("الكمية", "Qty")}</span>
                            <p className="font-medium">{t("المطلوب", "Need")}: {s.neededTons.toFixed(1)} {t("ط", "T")} · {t("متوفر", "Avail")}: {formatter.format(Math.round(s.substituteAvailableTons))} {t("ط", "T")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            s.confidence >= 70
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : s.confidence >= 40
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                              : "bg-destructive/10 text-destructive"
                          }`}>
                            {t("ثقة", "Conf.")} {s.confidence}%
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 flex-1">
                            <span className="font-semibold text-foreground/60">AI</span> {s.aiRationale}
                          </span>
                        </div>
                        {!isAccepted && !isRejected ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSuggApprove(aiSuggestionResult, idx)}
                              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {t("اعتماد", "Approve")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSuggReject(aiSuggestionResult, idx)}
                              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
                            >
                              <X className="w-3 h-3" />
                              {t("رفض", "Reject")}
                            </button>
                          </div>
                        ) : (
                          <span className={`text-[11px] font-medium flex items-center gap-1 ${isAccepted ? "text-emerald-600" : "text-destructive"}`}>
                            {isAccepted ? <><CheckCircle2 className="w-3 h-3" />{t("تم الاعتماد", "Approved")}</> : <><X className="w-3 h-3" />{t("تم الرفض", "Rejected")}</>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Auto-substitution banner ── */}
            <AnimatePresence>
              {hasSubstitutions && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 flex items-start gap-2.5">
                    <motion.div
                      animate={{ rotate: [0, -10, 10, -10, 0] }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                    >
                      <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    </motion.div>
                    <div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        {t("تم الاستبدال التلقائي للخامات","Raw materials auto-substituted")}
                      </p>
                      <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                        {t(
                          "بعض الخامات استُبدلت تلقائياً بالمتاح في المخزون للحفاظ على الأسعار والجودة.",
                          "Some ingredients were auto-swapped with available stock to keep pricing accurate."
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inventory availability check */}
            {selProductId&&tonsNum>0&&resolvedFormula.length>0&&(
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground"/>
                  <span className="text-xs font-semibold">{t("توفر الخامات في المخزون","Raw Material Availability")}</span>
                </div>
                {resolvedFormula.map(ing=>{
                  const needed=(tonsNum*ing.pct)/100;
                  const match=findInventoryMatch(ing.material,rawInventory);
                  const avail=match?(match.unit==="kg"?match.quantity/1000:match.quantity):0;
                  const ok=avail>=needed,pct=match?Math.min(100,(avail/needed)*100):0;
                  const isSwapped=!!ing.substitution;
                  const alertColor = match?.alertLevel === "critical" ? "bg-destructive" : match?.alertLevel === "warning" ? "bg-amber-500" : "bg-emerald-500";
                  const alertTextColor = match?.alertLevel === "critical" ? "text-destructive" : match?.alertLevel === "warning" ? "text-amber-600" : "text-emerald-600";
                  return(
                    <div key={ing.material} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {match && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${alertColor}`} />}
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={ing.material}
                              initial={{ x: isSwapped ? 20 : 0, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              exit={{ x: -20, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className={`text-muted-foreground ${isSwapped ? "font-medium text-amber-600 dark:text-amber-400" : ""}`}
                            >
                              {ing.material}
                            </motion.span>
                          </AnimatePresence>
                          {isSwapped && (
                            <motion.span
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 300, delay: 0.15 }}
                              className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400"
                            >
                              <ArrowLeftRight className="w-2.5 h-2.5" />
                              {ing.substitution!.originalMaterial}
                            </motion.span>
                          )}
                        </div>
                        <span className={`${match ? alertTextColor : "text-destructive"} font-medium`}>
                          {!match?t("غير موجود","Not in stock"):ok?`✓ ${avail.toFixed(0)}/${needed.toFixed(1)} ${t("ط","T")}`:`⚠ ${avail.toFixed(0)}/${needed.toFixed(1)} ${t("ط","T")}`}
                        </span>
                      </div>
                      {match&&<div className="h-1 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${isSwapped ? "bg-amber-400" : alertColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>}
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* Required materials with substitution animation */}
            {selProductId&&tonsNum>0&&(
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-xl border bg-muted/30 p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <FlaskConical className="w-4 h-4 text-primary"/>
                  <span className="font-semibold text-sm">{t("الخامات المطلوبة","Required Materials")}</span>
                  {hasSubstitutions && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      {t("تم الاستبدال","Substituted")}
                    </span>
                  )}
                </div>
                {resolvedFormula.map((ing,i)=>(
                  <SubstitutionIngredientRow
                    key={`${ing.material}-${i}`}
                    ing={ing}
                    needed={(tonsNum*ing.pct)/100}
                    t={t}
                  />
                ))}
                <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                  <span>{t("التكلفة التقديرية","Est. Cost")}</span>
                  <span className="text-primary">{new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(tonsNum*costPerTon)}</span>
                </div>
              </motion.div>
            )}


            <AnimatePresence mode="wait">
              {submitted?(
                <motion.div key="ok" initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{opacity:0}} className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-600 rounded-xl"><CheckCircle2 className="w-5 h-5"/><span className="font-medium">{t("تم إنشاء الأمر بنجاح!","Order created!")}</span></motion.div>
              ):(
                <motion.div key="btn" className="flex flex-col sm:flex-row gap-2">
                  <motion.div whileHover={{scale:1.02}} whileTap={{scale:0.98}} className="flex-1">
                    <Button className="w-full rounded-xl h-11 text-sm font-semibold shadow-sm" onClick={handleSubmit} disabled={!selProductId||!targetTons||!newWarehouse}>
                      {t("إنشاء أمر الإنتاج","Create Order")}
                    </Button>
                  </motion.div>
                  <Button variant="outline" className="w-full sm:w-auto rounded-xl h-11 px-6" onClick={()=>setSheetOpen(false)}>{t("إلغاء","Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      <EditOrderSheet order={editOrder} open={editOpen} onClose={()=>setEditOpen(false)} onSave={handleSaveEdit} t={t}/>

      {/* ── Production Report Dialog ── */}
      <Dialog open={reportOpen} onOpenChange={v=>{if(!reportGenerating)setReportOpen(v);}}>
        <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary"/>
              {t("تقرير الإنتاج","Production Report")}
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
                  <Label className="text-xs sm:text-sm">{t("الأقسام","Sections")}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {key:"summary",label:t("ملخص الأوامر","Orders Summary"),val:reportSummary,set:setReportSummary},
                      {key:"shortages",label:t("النواقص والمواد الحرجة","Shortages"),val:reportShortages,set:setReportShortages},
                      {key:"subs",label:t("الاستبدالات والفرق السعري","Substitutions"),val:reportSubstitutions,set:setReportSubstitutions},
                      {key:"list",label:t("قائمة الأوامر","Order List"),val:reportOrderList,set:setReportOrderList},
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
                  <Button className="flex-1 gap-2 text-xs sm:text-sm" onClick={handleGenerateProductionReport} disabled={reportDateMode==="range"&&!reportDateFrom&&!reportDateTo}>
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
                  <Button className="gap-2 text-xs sm:text-sm" onClick={handleDownloadProductionPDF}>
                    <Download className="w-3.5 h-3.5"/>{t("تحميل PDF","Download PDF")}
                  </Button>
                  <Button variant="outline" className="text-xs sm:text-sm" onClick={()=>{setReportOpen(false);setReportGenerated(false);}}>{t("إغلاق","Close")}</Button>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
