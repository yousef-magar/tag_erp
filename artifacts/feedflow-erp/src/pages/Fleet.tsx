import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useSalesStore } from "@/hooks/use-sales-store";
import { useFleetStore, type FleetVehicle, type Shipment, type ShipmentStop } from "@/hooks/use-fleet-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SmartInput from "@/components/SmartInput";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, MapPin, Navigation, Plus, Cpu, CheckCircle2, Route, Package, User, Phone, Weight, Gauge, FileText, X, AlertCircle, Clock, Loader2, Sparkles, Store, Hash, Trash2, Eye, Search, Edit3, ChevronsUpDown, BarChart3, Download, Wallet } from "lucide-react";
import { toast } from "sonner";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const fmtDate = (d: string) => { if (!d) return ""; const p = d.split("T")[0].split("-"); if (p.length !== 3) return d; return `${p[2]}/${p[1]}/${p[0]}`; };

type FleetTab = "vehicles" | "shipping";

interface AISuggestedLoad {
  vehicleId: string;
  vehicleName: string;
  driverName: string;
  driverPhone: string;
  stops: ShipmentStop[];
  totalWeight: number;
  remainingCapacity: number;
}

export default function Fleet() {
  const { t } = useAppStore();
  const { invoices, customers } = useSalesStore();
  const { vehicles, shipments, addVehicle, updateVehicle, deleteVehicle, addShipment, updateShipment, deleteShipment, addVehicleExpense, deleteVehicleExpense } = useFleetStore();

  const [tab, setTab] = useState<FleetTab>("vehicles");

  // Add / Edit vehicle form
  const [addOpen, setAddOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vName, setVName] = useState("");
  const [vPlate, setVPlate] = useState("");
  const [vDriver, setVDriver] = useState("");
  const [vDriverPhone, setVDriverPhone] = useState("");
  const [vType, setVType] = useState<string>("heavy");
  const [vCapacity, setVCapacity] = useState("");
  const [vLocationType, setVLocationType] = useState<string>("at-factory");
  const [vAddress, setVAddress] = useState("");
  const [addDone, setAddDone] = useState(false);

  // Vehicle detail
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedV, setSelectedV] = useState<FleetVehicle | null>(null);
  const [historyExpand, setHistoryExpand] = useState(false);
  const [histDateFrom, setHistDateFrom] = useState("");
  const [histDateTo, setHistDateTo] = useState("");
  const [histMode, setHistMode] = useState<"all" | "today" | "custom">("all");
  // Expenses
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCat, setExpenseCat] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expHistMode, setExpHistMode] = useState<"all" | "today" | "custom">("all");
  const [expHistDateFrom, setExpHistDateFrom] = useState("");
  const [expHistDateTo, setExpHistDateTo] = useState("");
  // Delivery confirm
  const [deliverConfirmId, setDeliverConfirmId] = useState<string | null>(null);

  // Shipping / AI
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiDone, setAiDone] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestedLoad[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [shipSearch, setShipSearch] = useState("");
  const [shipHistMode, setShipHistMode] = useState<"all" | "today" | "custom">("all");
  const [shipDateFrom, setShipDateFrom] = useState("");
  const [shipDateTo, setShipDateTo] = useState("");
  const [shipDriverFilter, setShipDriverFilter] = useState("");
  const [shipDriverOpen, setShipDriverOpen] = useState(false);
  // Manual assignment
  const [manualOpen, setManualOpen] = useState(false);
  const [manualVehIds, setManualVehIds] = useState<Set<string>>(new Set());

  // ── Report State ──
  type DateMode = "all" | "today" | "range";
  const [repOpen, setRepOpen] = useState(false);
  const [repDateMode, setRepDateMode] = useState<DateMode>("all");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repGenerated, setRepGenerated] = useState(false);
  const [repGenerating, setRepGenerating] = useState(false);
  const [repSummary, setRepSummary] = useState(true);
  const [repShipments, setRepShipments] = useState(true);
  const [repVehicles, setRepVehicles] = useState(true);

  const aiSteps = [
    t("تحليل الفواتير المعلقة...", "Analyzing pending invoices..."),
    t("تجميع الطلبات حسب المنطقة...", "Grouping orders by region..."),
    t("حساب الأوزان واختيار السيارات...", "Calculating weights & selecting vehicles..."),
    t("اقتراح التوزيع الأمثل...", "Proposing optimal distribution..."),
    t("اكتمل التحسين!", "Optimization complete!"),
  ];

  // Pending invoices (not yet shipped)
  const shippedInvoiceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of shipments) {
      for (const stop of s.stops) ids.add(stop.invoiceId);
    }
    return ids;
  }, [shipments]);

  const pendingInvoices = useMemo(() => {
    return invoices.filter(inv => !shippedInvoiceIds.has(inv.id) && inv.needsDelivery);
  }, [invoices, shippedInvoiceIds]);

  const filteredPending = useMemo(() => {
    if (!shipSearch.trim()) return pendingInvoices;
    const q = shipSearch.trim().toLowerCase();
    return pendingInvoices.filter(inv =>
      inv.id.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q)
    );
  }, [pendingInvoices, shipSearch]);

  const availableVehicles = useMemo(() => vehicles.filter(v => v.status === "available"), [vehicles]);

  // Toggle invoice selection
  const toggleInvoice = (id: string) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedWeight = useMemo(() => {
    let total = 0;
    for (const inv of invoices) {
      if (selectedInvoices.has(inv.id)) {
        total += inv.items.reduce((s, item) => s + item.qtyTons, 0);
      }
    }
    return total;
  }, [invoices, selectedInvoices]);

  // AI Optimization
  const runAi = () => {
    setAiStep(0);
    setAiDone(false);
    setAiRunning(true);
    setAiSuggestions([]);
  };

  useEffect(() => {
    if (!aiRunning) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (aiStep === 0) {
      timer = setTimeout(() => setAiStep(1), 600);
    } else if (aiStep === 1) {
      timer = setTimeout(() => setAiStep(2), 600);
    } else if (aiStep === 2) {
      timer = setTimeout(() => setAiStep(3), 600);
    } else if (aiStep === 3) {
      timer = setTimeout(() => {
        const selectedInvData = invoices.filter(inv => selectedInvoices.has(inv.id));
        const allStops: ShipmentStop[] = selectedInvData.map(inv => {
          const cust = customers.find(c => c.id === inv.customerId);
          const weight = inv.items.reduce((s, item) => s + item.qtyTons, 0);
          // Use deliveryAddress from invoice if available, else fallback to customer
          const gov = inv.deliveryAddress?.governorate || cust?.governorate || "";
          const region = inv.deliveryAddress?.region || cust?.region || "";
          const village = inv.deliveryAddress?.village;
          const addr = inv.deliveryAddress?.details || cust?.address || "";
          return {
            invoiceId: inv.id,
            customerId: inv.customerId,
            customerName: inv.customerName,
            customerPhone: inv.customerPhone,
            address: addr,
            region,
            governorate: gov,
            village: village || undefined,
            weightTons: weight,
          };
        });

        // Group by governorate first, then by region within same governorate
        const groups = new Map<string, ShipmentStop[]>();
        for (const stop of allStops) {
          const key = stop.governorate ? `${stop.governorate}||${stop.region || "أخرى"}` : (stop.region || "أخرى");
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(stop);
        }

        // Sort groups: largest weight first
        const sortedGroups = [...groups.entries()].sort((a, b) => {
          const wA = a[1].reduce((s, st) => s + st.weightTons, 0);
          const wB = b[1].reduce((s, st) => s + st.weightTons, 0);
          return wB - wA;
        });

        // Build list of vehicles with their current load already accounted for
        const availWithLoad = vehicles
          .filter(v => v.status === "available")
          .map(v => {
            const activeLoad = shipments
              .filter(s => s.vehicleId === v.id && s.status !== "delivered")
              .reduce((s, sh) => s + sh.totalWeight, 0);
            return { ...v, remainingCapacity: v.maxCapacity - activeLoad };
          })
          .filter(v => v.remainingCapacity > 0)
          .sort((a, b) => b.remainingCapacity - a.remainingCapacity);

        const suggestions: AISuggestedLoad[] = [];

        // For each group, find best-fit vehicle
        for (const [, stops] of sortedGroups) {
          const groupWeight = stops.reduce((s, st) => s + st.weightTons, 0);
          let remainingStops = [...stops];

          while (remainingStops.length > 0) {
            // Find the vehicle with smallest remaining capacity that can fit the remaining group weight,
            // or the one with largest remaining capacity as fallback
            const fitIdx = availWithLoad.findIndex(v => v.remainingCapacity >= groupWeight);
            const targetIdx = fitIdx >= 0 ? fitIdx : 0;
            if (targetIdx >= availWithLoad.length) break;
            const veh = availWithLoad[targetIdx];

            // Pack as many stops as possible into this vehicle
            const assignStops: ShipmentStop[] = [];
            let acc = 0;
            const unassigned: ShipmentStop[] = [];
            for (const stop of remainingStops) {
              if (acc + stop.weightTons <= veh.remainingCapacity) {
                assignStops.push(stop);
                acc += stop.weightTons;
              } else {
                unassigned.push(stop);
              }
            }
            // If only one stop doesn't fit, assign it anyway (partial delivery is better than none)
            if (assignStops.length === 0 && remainingStops.length > 0) {
              assignStops.push(remainingStops[0]);
              acc = remainingStops[0].weightTons;
              unassigned.splice(0, 1);
            }

            suggestions.push({
              vehicleId: veh.id,
              vehicleName: veh.name,
              driverName: veh.driver,
              driverPhone: veh.driverPhone,
              stops: assignStops,
              totalWeight: acc,
              remainingCapacity: Math.max(0, veh.remainingCapacity - acc),
            });
            veh.remainingCapacity -= acc;
            remainingStops = unassigned;

            // Remove vehicle from pool if no capacity left
            if (veh.remainingCapacity <= 0) {
              const idx = availWithLoad.indexOf(veh);
              if (idx >= 0) availWithLoad.splice(idx, 1);
            }
            if (availWithLoad.length === 0) break;
          }
        }

        setAiSuggestions(suggestions);
        setAiStep(4);
        setAiDone(true);
        setAiRunning(false);
      }, 700);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [aiRunning, aiStep, invoices, customers, availableVehicles, selectedInvoices]);

  const confirmSuggestions = () => {
    setConfirming(true);
    for (const sug of aiSuggestions) {
      const shipment: Shipment = {
        id: `SHP-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        vehicleId: sug.vehicleId,
        vehicleName: sug.vehicleName,
        driverName: sug.driverName,
        driverPhone: sug.driverPhone,
        stops: sug.stops,
        totalWeight: sug.totalWeight,
        status: "pending",
        date: new Date().toISOString().split("T")[0],
      };
      addShipment(shipment);
    }
    setSelectedInvoices(new Set());
    setAiOpen(false);
    setAiDone(false);
    setConfirming(false);
  };

  const openEditVehicle = (v: FleetVehicle) => {
    setEditingVehicleId(v.id);
    setVName(v.name);
    setVPlate(v.plate || "");
    setVDriver(v.driver);
    setVDriverPhone(v.driverPhone || "");
    setVType(v.type);
    setVCapacity(String(v.maxCapacity));
    setVLocationType(v.locationType);
    setVAddress(v.address || "");
    setAddOpen(true);
  };

  const handleAddVehicle = async () => {
    if (!vName || !vDriver || !vCapacity) return;
    if (editingVehicleId) {
      await updateVehicle(editingVehicleId, {
        name: vName,
        plate: vPlate,
        driver: vDriver,
        driverPhone: vDriverPhone,
        type: vType as any,
        maxCapacity: parseFloat(vCapacity),
        locationType: vLocationType as "at-factory" | "with-driver",
        address: vAddress || undefined,
      });
    } else {
      await addVehicle({
        name: vName,
        plate: vPlate,
        driver: vDriver,
        driverPhone: vDriverPhone,
        type: vType as any,
        maxCapacity: parseFloat(vCapacity),
        status: "available",
        locationType: vLocationType as "at-factory" | "with-driver",
        address: vAddress || undefined,
      });
    }
    setAddDone(true);
    setTimeout(() => {
      setAddDone(false); setAddOpen(false);
      setEditingVehicleId(null);
      setVName(""); setVPlate(""); setVDriver(""); setVDriverPhone(""); setVType("heavy"); setVCapacity(""); setVLocationType("at-factory"); setVAddress("");
    }, 1400);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{t("متاح", "Available")}</Badge>;
      case "loading": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">{t("تحميل", "Loading")}</Badge>;
      case "on-route": return <Badge className="bg-primary/10 text-primary border-primary/20">{t("في الطريق", "On Route")}</Badge>;
      case "delivered": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">{t("تم التسليم", "Delivered")}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getShipStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">{t("معلق", "Pending")}</Badge>;
      case "loaded": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">{t("محملة", "Loaded")}</Badge>;
      case "on-route": return <Badge className="bg-primary/10 text-primary border-primary/20">{t("في الطريق", "On Route")}</Badge>;
      case "delivered": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{t("تم التسليم", "Delivered")}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const vehicleLoad = (v: FleetVehicle) => {
    const activeShipments = shipments.filter(s => s.vehicleId === v.id && s.status !== "delivered");
    return activeShipments.reduce((s, sh) => s + sh.totalWeight, 0);
  };

  // ── Fleet Report ──
  const handleGenerateFleetReport = () => {
    if (repDateMode === "range" && !repDateFrom && !repDateTo) return;
    setRepGenerating(true);
    setTimeout(() => { setRepGenerating(false); setRepGenerated(true); }, 1200);
  };
  const handleDownloadFleetPDF = () => {
    const { companyName, companyLogo, companyAddress } = useAppStore.getState();
    const nowStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const todayStr = new Date().toISOString().split("T")[0];
    const periodLabel = repDateMode === "all" ? t("كل الفترة", "All Period") : repDateMode === "today" ? t("اليوم فقط", "Today Only") : `${t("من", "From")} ${repDateFrom || "..."} ${t("إلى", "to")} ${repDateTo || "..."}`;
    const rptShipments = shipments.filter(s => {
      if (repDateMode === "today" && s.date !== todayStr) return false;
      if (repDateMode === "range") {
        if (repDateFrom && s.date < repDateFrom) return false;
        if (repDateTo && s.date > repDateTo) return false;
      }
      return true;
    });
    const totalShipments = rptShipments.length;
    const completedShipments = rptShipments.filter(s => s.status === "delivered");
    const pendingShipments = rptShipments.filter(s => s.status !== "delivered");
    const vehicleStats = vehicles.map(v => ({
      ...v,
      shipmentCount: rptShipments.filter(s => s.vehicleId === v.id).length,
      shipmentTotal: 0,
    })).filter(v => v.shipmentCount > 0).sort((a, b) => b.shipmentCount - a.shipmentCount);
    
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
      .num-blue{color:#1d4ed8}.num-green{color:#15803d}.num-red{color:#dc2626}.num-amber{color:#b45309}
      table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11px;border-radius:6px;overflow:hidden}
      th{background:#1d4ed8;color:#fff;font-weight:600;padding:7px 6px;font-size:11px}
      td{border:1px solid #e2e8f0;padding:6px}
      tr:nth-child(even){background:#f8fafc}
      .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:500}
      .badge-green{background:#dcfce7;color:#15803d}.badge-red{background:#fee2e2;color:#dc2626}.badge-amber{background:#fef3c7;color:#b45309}.badge-blue{background:#dbeafe;color:#1d4ed8}
      .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:25px}
      .footer-logo{font-weight:700;color:#1d4ed8}
    `;
    const content = `
      <div class="watermark">${companyName || "تاج"}</div>
      <div class="header">
        <div class="header-right"><h1>${t("تقرير الناقلات", "Fleet Report")}</h1><p class="sub">${periodLabel}</p></div>
        <div class="header-left">${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:4px" alt=""/>` : ""}<div class="company">${companyName || "تاج"}</div>${companyAddress ? `<div>${companyAddress}</div>` : ""}<div style="margin-top:2px">${t("تاريخ الإنشاء", "Generated")}: ${nowStr}</div></div>
      </div>
      <div class="meta"><span>🚛 ${totalShipments} ${t("شحنة", "shipment(s)")}</span><span>⚖️ ${fmtNum(rptShipments.reduce((s, sh) => s + sh.totalWeight, 0))} ${t("ط", "T")}</span></div>
      ${repSummary ? `
      <div class="section"><h2>${t("ملخص الناقلات", "Fleet Summary")}</h2>
        <div class="grid">
          <div class="card"><div class="num num-blue">${totalShipments}</div><div class="lbl">${t("إجمالي الشحنات", "Total Shipments")}</div></div>
          <div class="card"><div class="num num-green">${completedShipments.length}</div><div class="lbl">${t("مكتمل", "Completed")}</div></div>
          <div class="card"><div class="num num-amber">${pendingShipments.length}</div><div class="lbl">${t("قيد التسليم", "Pending")}</div></div>
          <div class="card"><div class="num num-blue">${fmtNum(rptShipments.reduce((s, sh) => s + sh.totalWeight, 0))}</div><div class="lbl">${t("إجمالي الوزن", "Total Weight")}</div></div>
        </div>
      </div>` : ""}
      ${repVehicles && vehicleStats.length > 0 ? `
      <div class="section"><h2>${t("أداء الناقلات", "Vehicle Performance")}</h2>
        <table><tr><th>#</th><th>${t("الناقلة", "Vehicle")}</th><th>${t("اللوحة", "Plate")}</th><th>${t("الشحنات", "Shipments")}</th><th>${t("الوزن", "Weight")}</th></tr>
        ${vehicleStats.map((v, i) => `<tr><td>${i + 1}</td><td><strong>${v.name}</strong></td><td>${v.plate || "—"}</td><td>${v.shipmentCount}</td><td>${fmtNum(rptShipments.filter(s => s.vehicleId === v.id).reduce((s, sh) => s + sh.totalWeight, 0))} ${t("ط", "T")}</td></tr>`).join("")}
        </table>
      </div>` : ""}
      ${repShipments && rptShipments.length > 0 ? `
      <div class="section"><h2>${t("قائمة الشحنات", "Shipments List")} (${totalShipments})</h2>
        <table><tr><th>${t("الشحنة", "Shipment")}</th><th>${t("الناقلة", "Vehicle")}</th><th>${t("التاريخ", "Date")}</th><th>${t("الوجهة", "Destination")}</th><th>${t("الحالة", "Status")}</th><th>${t("الوزن", "Weight")}</th></tr>
        ${rptShipments.map(s => {
          const v = vehicles.find(v => v.id === s.vehicleId);
          const st = s.status === "delivered" ? `<span class="badge badge-green">${t("تم","Delivered")}</span>` : s.status === "on-route" ? `<span class="badge badge-blue">${t("في الطريق","On Route")}</span>` : `<span class="badge badge-amber">${t("معلق","Pending")}</span>`;
          const dest = s.stops.map(st => st.region || st.governorate).filter(Boolean).join("، ") || "—";
          return `<tr><td style="font-weight:600">${s.id}</td><td>${v?.name || "—"}</td><td>${s.date}</td><td>${dest}</td><td>${st}</td><td style="font-weight:600">${fmtNum(s.totalWeight)} ${t("ط", "T")}</td></tr>`;
        }).join("")}
        </table>
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

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      {/* Header */}
      <motion.div variants={itemVariants} className="relative rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-4 sm:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">{t("الأسطول", "Fleet")}</h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("إدارة المركبات والشحن", "Vehicle & shipping management")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setRepOpen(true)}>
              <BarChart3 className="w-4 h-4" />{t("تقرير", "Report")}
            </Button>
            {tab === "vehicles" && (
              <Button className="gap-2 rounded-xl" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" />{t("إضافة مركبة", "Add Vehicle")}
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="relative flex gap-1 p-1 bg-muted/40 border border-border/50 rounded-xl w-fit">
        {[
          { id: "vehicles" as FleetTab, label: t("المركبات", "Vehicles"), icon: <Truck className="w-3.5 h-3.5" /> },
          { id: "shipping" as FleetTab, label: t("الشحن", "Shipping"), icon: <Package className="w-3.5 h-3.5" /> },
        ].map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${tab === tabItem.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === tabItem.id && (
              <motion.span layoutId="fleetTab" className="absolute inset-0 bg-background shadow rounded-lg"
                transition={{ type: "spring", stiffness: 300, damping: 25 }} />
            )}
            <span className="relative z-[1] flex items-center gap-2">{tabItem.icon}{tabItem.label}</span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Truck className="w-4 h-4" /></div>
          <div><p className="text-[10px] text-muted-foreground">{t("إجمالي المركبات", "Total Vehicles")}</p><p className="text-sm font-bold">{vehicles.length}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
          <div><p className="text-[10px] text-muted-foreground">{t("متاح", "Available")}</p><p className="text-sm font-bold">{vehicles.filter(v => v.status === "available").length}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Navigation className="w-4 h-4" /></div>
          <div><p className="text-[10px] text-muted-foreground">{t("في الطريق", "On Route")}</p><p className="text-sm font-bold">{vehicles.filter(v => v.status === "on-route").length}</p></div>
        </Card>
        <Card className="p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"><Package className="w-4 h-4" /></div>
          <div><p className="text-[10px] text-muted-foreground">{t("شحنات اليوم", "Today's Shipments")}</p><p className="text-sm font-bold">{shipments.filter(s => s.date === new Date().toISOString().split("T")[0]).length}</p></div>
        </Card>
      </div>

      {/* ─── VEHICLES TAB ─── */}
      {tab === "vehicles" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.map(v => {
            const load = vehicleLoad(v);
            const pct = v.maxCapacity > 0 ? Math.round((load / v.maxCapacity) * 100) : 0;
            return (
              <motion.div key={v.id} variants={itemVariants} layout
                className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => { setSelectedV(v); setDetailOpen(true); }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{v.name}</h3>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3" />{v.driver}
                      </p>
                    </div>
                  </div>
                  <div onClick={e => { e.stopPropagation(); if (v.status === "available") { updateVehicle(v.id, { status: "loading" }); toast.info(t("تم التحميل", "Loading")); } else if (v.status === "loading") { const active = shipments.find(s => s.vehicleId === v.id && (s.status === "pending" || s.status === "loaded")); if (active) updateShipment(active.id, { status: "on-route" }); else updateVehicle(v.id, { status: "on-route" }); toast.info(t("في الطريق", "On Route")); } else if (v.status === "on-route") { setDeliverConfirmId(v.id); } }}>
                    {getStatusBadge(v.status)}
                  </div>
                </div>

                {/* Capacity bar */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1"><Weight className="w-3 h-3" />{t("الحمولة", "Load")}</span>
                    <span className="font-medium">{fmtNum(load)} / {fmtNum(v.maxCapacity)} {t("ط", "T")}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
                      className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                      transition={{ duration: 0.5 }} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <Badge variant="outline" className="text-[8px] h-4 px-1 font-normal">{v.locationType === "with-driver" ? t("مع السواق", "With Driver") : t("فى المصنع", "At Factory")}</Badge>
                  {v.address && <span className="truncate">— {v.address}</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── SHIPPING TAB ─── */}
      {tab === "shipping" && (
        <div className="space-y-3 sm:space-y-4">
          {/* Pending invoices section */}
          <Card className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">{t("الفواتير المعلقة للشحن", "Pending Invoices for Shipping")}</h3>
                <span className="text-[10px] text-muted-foreground">({filteredPending.length})</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[120px]">
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
                  <Input className="h-8 w-full pr-7 text-xs rounded-lg" placeholder={t("بحث...", "Search...")} value={shipSearch} onChange={e => setShipSearch(e.target.value)} />
                </div>
                {selectedInvoices.size > 0 && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1 rounded-lg" onClick={() => setManualOpen(true)}>
                      <Truck className="w-3.5 h-3.5" />{t("تعيين يدوي", "Manual Assign")}
                    </Button>
                    <Button size="sm" className="h-8 text-[11px] gap-1 rounded-lg" onClick={() => setAiOpen(true)}>
                      <Sparkles className="w-3.5 h-3.5" />{t("تحسين ذكي (AI)", "AI Optimize")}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {filteredPending.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">{t("لا توجد فواتير معلقة للشحن", "No pending invoices for shipping")}</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                {filteredPending.map(inv => {
                  const weight = inv.items.reduce((s, item) => s + item.qtyTons, 0);
                  const cust = customers.find(c => c.id === inv.customerId);
                  const checked = selectedInvoices.has(inv.id);
                  return (
                    <div key={inv.id} onClick={() => toggleInvoice(inv.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "border-border/60 hover:bg-muted/20"}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{inv.id}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{inv.customerName}</p>
                      </div>
                      <div className="text-end">
                        <p className="text-xs font-bold">{fmtNum(weight)} {t("ط", "T")}</p>
                        <p className="text-[9px] text-muted-foreground">{cust?.region || cust?.governorate || "—"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedInvoices.size > 0 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-xs">
                <span className="text-muted-foreground">{t("المحدد", "Selected")}: <strong>{selectedInvoices.size}</strong> {t("فاتورة", "invoice")}</span>
                <span className="font-semibold">{t("الوزن الإجمالي", "Total Weight")}: <strong>{fmtNum(selectedWeight)}</strong> {t("ط", "T")}</span>
              </div>
            )}
          </Card>

          {/* Active shipments */}
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {t("الشحنات النشطة", "Active Shipments")}
              <span className="text-[10px] text-muted-foreground">({shipments.length})</span>
            </h3>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="flex-1 min-w-[140px]">
                <Popover open={shipDriverOpen} onOpenChange={setShipDriverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={shipDriverOpen}
                      className="w-full h-8 text-[10px] justify-between rounded-md">
                      {shipDriverFilter ? (() => {
                        const parts = shipments.reduce<string[]>((acc, sh) => {
                          const v = `${sh.vehicleName} — ${sh.driverName}`;
                          if (!acc.includes(v)) acc.push(v);
                          return acc;
                        }, []);
                        return parts.find(p => p === shipDriverFilter) || shipDriverFilter;
                      })() : t("السواق أو العربية...", "Driver or vehicle...")}
                      <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[240px] p-0">
                    <Command>
                      <CommandInput placeholder={t("بحث...", "Search...")} className="h-8 text-[10px]" />
                      <CommandList>
                        <CommandEmpty className="text-[10px] py-2">{t("لا توجد نتائج", "No results")}</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="all" onSelect={() => { setShipDriverFilter(""); setShipDriverOpen(false); }}
                            className="text-[10px]">
                            {t("الكل", "All")}
                          </CommandItem>
                          {Array.from(new Set(shipments.map(sh => `${sh.vehicleName} — ${sh.driverName}`))).map(v => (
                            <CommandItem key={v} value={v} onSelect={() => { setShipDriverFilter(v); setShipDriverOpen(false); }}
                              className="text-[10px]">
                              {v}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-1 flex-wrap">
                {[
                  { id: "all" as const, label: t("الكل", "All") },
                  { id: "today" as const, label: t("اليوم", "Today") },
                  { id: "custom" as const, label: t("مخصص", "Custom") },
                ].map(f => (
                  <button key={f.id} type="button" onClick={() => {
                    setShipHistMode(f.id);
                    if (f.id === "all") { setShipDateFrom(""); setShipDateTo(""); }
                    else if (f.id === "today") { const d = new Date().toISOString().split("T")[0]; setShipDateFrom(d); setShipDateTo(d); }
                  }}
                    className={`px-2.5 py-1 text-[9px] rounded-md border transition-colors whitespace-nowrap ${shipHistMode === f.id ? "bg-primary/10 border-primary/30 text-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              {shipHistMode === "custom" && (
                <>
                  <input type="date" value={shipDateFrom} onChange={e => setShipDateFrom(e.target.value)}
                    className="w-full sm:w-[120px] h-7 text-[9px] rounded-md border border-input bg-transparent px-1" />
                  <span className="self-center text-[9px] text-muted-foreground">{t("إلى", "to")}</span>
                  <input type="date" value={shipDateTo} onChange={e => setShipDateTo(e.target.value)}
                    className="w-full sm:w-[120px] h-7 text-[9px] rounded-md border border-input bg-transparent px-1" />
                </>
              )}
            </div>
            {(() => {
              let fs = shipments;
              if (shipDriverFilter) {
                fs = fs.filter(sh => `${sh.vehicleName} — ${sh.driverName}` === shipDriverFilter);
              }
              if (shipHistMode === "custom" && !shipDateFrom && !shipDateTo) fs = [];
              if (shipDateFrom) fs = fs.filter(s => s.date >= shipDateFrom);
              if (shipDateTo) fs = fs.filter(s => s.date <= shipDateTo);
              return fs.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">{t("لا توجد شحنات", "No shipments")}</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {fs.map(sh => (
                    <Card key={sh.id} className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">{sh.id}</span>
                            {getShipStatusBadge(sh.status)}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {sh.vehicleName} — {sh.driverName}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs font-bold">{fmtNum(sh.totalWeight)} {t("ط", "T")}</p>
                          <p className="text-[9px] text-muted-foreground">{fmtDate(sh.date)}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {sh.stops.map((stop, idx) => (
                          <div key={stop.invoiceId} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                            <span className="truncate flex-1">{stop.customerName}</span>
                            <span className="font-medium">{fmtNum(stop.weightTons)} {t("ط", "T")}</span>
                            <Badge variant="outline" className="text-[8px] h-4 px-1">{stop.region || stop.governorate}</Badge>
                          </div>
                        ))}
                      </div>
                      {sh.status !== "delivered" && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-border/30 flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 rounded-lg"
                            onClick={() => updateShipment(sh.id, { status: "on-route" })}>
                            <Navigation className="w-3 h-3" />{t("تحديد في الطريق", "Set On Route")}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 rounded-lg"
                            onClick={() => updateShipment(sh.id, { status: "delivered" })}>
                            <CheckCircle2 className="w-3 h-3" />{t("تأكيد التسليم", "Confirm Delivery")}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 ms-auto text-muted-foreground hover:text-destructive"
                            onClick={() => deleteShipment(sh.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── ADD / EDIT VEHICLE SHEET ─── */}
      <Sheet open={addOpen} onOpenChange={v => { if (!v) { setAddOpen(false); setEditingVehicleId(null); } }}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingVehicleId ? t("تعديل بيانات المركبة", "Edit Vehicle") : t("إضافة مركبة جديدة", "Add New Vehicle")}</SheetTitle>
            <SheetDescription>{t("بيانات المركبة والسائق والحمولة القصوى", "Vehicle, driver & max capacity")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("رقم اللوحة", "Plate Number")}</Label>
              <Input className="h-11 rounded-xl" placeholder={t("مثال: ع ن 1234", "e.g. ABC 1234")} value={vPlate} onChange={e => setVPlate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("اسم / موديل المركبة", "Vehicle Name")}</Label>
              <SmartInput field="product-name" value={vName} onChange={setVName} extraSuggestions={vehicles.map(v => v.name)} placeholder={t("مثال: نقل ثقيل مرسيدس", "e.g. Heavy Truck Mercedes")} className="h-11 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("اسم السائق", "Driver")}</Label>
                <SmartInput field="driver-name" value={vDriver} onChange={setVDriver} extraSuggestions={[...new Set(vehicles.map(v => v.driver))]} placeholder={t("اسم السائق", "Driver name")} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("هاتف السائق", "Driver Phone")}</Label>
                <Input className="h-11 rounded-xl" placeholder="01XXXXXXXXX" value={vDriverPhone} onChange={e => setVDriverPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("نوع المركبة", "Type")}</Label>
                <Select value={vType} onValueChange={setVType}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heavy">{t("نقل ثقيل", "Heavy Truck")}</SelectItem>
                    <SelectItem value="semi">{t("نصف نقل", "Semi Truck")}</SelectItem>
                    <SelectItem value="quarter">{t("ربع نقل", "Quarter Truck")}</SelectItem>
                    <SelectItem value="light">{t("نقل خفيف", "Light Truck")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("الحمولة القصوى (طن)", "Max Capacity (Tons)")}</Label>
                <Input type="number" min="0" step="0.5" className="h-11 text-lg font-bold text-center rounded-xl" placeholder="0" value={vCapacity} onChange={e => setVCapacity(e.target.value)} />
              </div>
            </div>

            {/* Location Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("مكان المركبة", "Vehicle Location")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "at-factory", label: t("فى المصنع", "At Factory"), icon: <Store className="w-3.5 h-3.5" /> },
                  { id: "with-driver", label: t("مع السواق", "With Driver"), icon: <User className="w-3.5 h-3.5" /> },
                ].map(opt => (
                  <button key={opt.id} type="button" onClick={() => setVLocationType(opt.id)}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${vLocationType === opt.id ? "bg-primary/10 border-primary text-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                    {opt.icon}{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Address (shown when at factory without specific address, or with-driver with specific address) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("العنوان (اختياري)", "Address (optional)")}</Label>
              <SmartInput field="driver-name" value={vAddress} onChange={setVAddress} extraSuggestions={[...new Set(vehicles.filter(v => v.address).map(v => v.address!))]} placeholder={t("مثال: المنطقة الصناعية - قطعة 5", "e.g. Industrial Zone, Block 5")} className="h-11 rounded-xl" />
            </div>
            <AnimatePresence mode="wait">
               {addDone ? (
                  <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 className="w-5 h-5" /><span className="font-bold">{editingVehicleId ? t("تم الحفظ!", "Saved!") : t("تم الإضافة!", "Added!")}</span>
                  </motion.div>
              ) : (
                <motion.div key="b" className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Button className="w-full sm:flex-1 h-11 rounded-xl text-sm font-bold" onClick={handleAddVehicle} disabled={!vName || !vDriver || !vCapacity}>
                    {editingVehicleId ? t("حفظ التعديلات", "Save Changes") : t("إضافة المركبة", "Add Vehicle")}
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto h-11 rounded-xl px-6" onClick={() => { setAddOpen(false); setEditingVehicleId(null); }}>{t("إلغاء", "Cancel")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── VEHICLE DETAIL DIALOG ─── */}
      <Dialog open={detailOpen} onOpenChange={v => { if (!v) { setDetailOpen(false); setHistoryExpand(false); setHistDateFrom(""); setHistDateTo(""); setHistMode("all"); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("تفاصيل المركبة", "Vehicle Details")}</DialogTitle>
          </DialogHeader>
          {selectedV && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <div className="p-3 bg-primary/10 text-primary rounded-lg"><Truck className="w-8 h-8" /></div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{selectedV.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedV.plate}</p>
                </div>
                {getStatusBadge(selectedV.status)}
              </div>

              {/* Basic info */}
              <div className="space-y-3">
                {[
                  [<User className="w-4 h-4" />, t("السائق", "Driver"), selectedV.driver],
                  [<Phone className="w-4 h-4" />, t("هاتف السائق", "Driver Phone"), selectedV.driverPhone || "—"],
                  [<Weight className="w-4 h-4" />, t("الحمولة القصوى", "Max Capacity"), `${fmtNum(selectedV.maxCapacity)} ${t("طن", "Tons")}`],
                  [<Gauge className="w-4 h-4" />, t("الحمولة الحالية", "Current Load"), `${fmtNum(vehicleLoad(selectedV))} ${t("طن", "Tons")}`],
                  [<Store className="w-4 h-4" />, t("مكان المركبة", "Location"), selectedV.locationType === "with-driver" ? t("مع السواق", "With Driver") : t("فى المصنع", "At Factory")],
                  ...(selectedV.address ? [[<MapPin className="w-4 h-4" />, t("العنوان", "Address"), selectedV.address] as any] : []),
                ].map(([icon, label, val]: any) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border/40 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
                    <span className="font-medium text-xs">{val}</span>
                  </div>
                ))}
              </div>

              {/* Active shipment info */}
              {(() => {
                const activeShip = shipments.find(s => s.vehicleId === selectedV.id && s.status !== "delivered");
                if (!activeShip) return null;
                return (
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Navigation className="w-3.5 h-3.5 text-primary" />
                        {t("الشحنة الحالية", "Current Shipment")}
                      </div>
                      {getShipStatusBadge(activeShip.status)}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{t("الوجهات", "Destinations")}:</p>
                    <div className="space-y-1">
                      {activeShip.stops.map((stop, i) => {
                        const inv = invoices.find(v => v.id === stop.invoiceId);
                        return (
                          <div key={stop.invoiceId} className="flex items-start gap-2 p-2 rounded-lg bg-background border border-border/40">
                            <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[9px] font-bold">{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold">{stop.customerName}</p>
                              <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />{stop.customerPhone}
                              </p>
                              <p className="text-[9px] text-muted-foreground">
                                {stop.governorate}{stop.region ? ` — ${stop.region}` : ""}{stop.village ? ` — ${stop.village}` : ""}
                              </p>
                              {stop.address && <p className="text-[9px] text-muted-foreground">{stop.address}</p>}
                              {inv && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {inv.items.map((item, j) => (
                                    <span key={j} className="text-[8px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{item.productName}: {fmtNum(item.qtyTons)} {t("ط", "T")}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold shrink-0">{fmtNum(stop.weightTons)} {t("ط", "T")}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/30">
                      <span className="text-muted-foreground">{t("إجمالي وزن الشحنة", "Total Shipment Weight")}</span>
                      <span className="font-bold">{fmtNum(activeShip.totalWeight)} {t("ط", "T")}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Trip history */}
              <div className="rounded-xl border border-border/60">
                <button type="button" onClick={() => setHistoryExpand(!historyExpand)}
                  className="flex items-center justify-between w-full p-3 text-xs font-semibold hover:bg-muted/20 transition-colors rounded-xl">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    {t("سجل الرحلات", "Trip History")}
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground transition-transform" style={{ transform: historyExpand ? "rotate(180deg)" : undefined }} />
                </button>
                {historyExpand && (
                  <div className="px-3 pb-3 space-y-2">
                    {/* Quick filters */}
                    <div className="flex gap-1">
                      {[
                        { id: "all" as const, label: t("الكل", "All") },
                        { id: "today" as const, label: t("اليوم", "Today") },
                        { id: "custom" as const, label: t("مخصص", "Custom") },
                      ].map(f => (
                        <button key={f.id} type="button" onClick={() => {
                          setHistMode(f.id);
                          if (f.id === "all") { setHistDateFrom(""); setHistDateTo(""); }
                          else if (f.id === "today") { const d = new Date().toISOString().split("T")[0]; setHistDateFrom(d); setHistDateTo(d); }
                        }}
                          className={`px-2.5 py-1 text-[9px] rounded-md border transition-colors ${histMode === f.id ? "bg-primary/10 border-primary/30 text-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                    {/* Date range inputs (only on custom) */}
                    {histMode === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-[9px] text-muted-foreground">{t("من", "From")}</Label>
                          <input type="date" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)}
                            className="w-full h-7 text-[10px] rounded-md border border-input bg-transparent px-2" />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[9px] text-muted-foreground">{t("إلى", "To")}</Label>
                          <input type="date" value={histDateTo} onChange={e => setHistDateTo(e.target.value)}
                            className="w-full h-7 text-[10px] rounded-md border border-input bg-transparent px-2" />
                        </div>
                      </div>
                    )}
                    {(() => {
                      let historyShipments = shipments.filter(s => s.vehicleId === selectedV.id && s.status === "delivered");
                      if (histMode === "custom" && !histDateFrom && !histDateTo) historyShipments = [];
                      if (histDateFrom) historyShipments = historyShipments.filter(s => s.date >= histDateFrom);
                      if (histDateTo) historyShipments = historyShipments.filter(s => s.date <= histDateTo);
                      if (historyShipments.length === 0) return <p className="text-[10px] text-muted-foreground py-2 text-center">{t("لا توجد رحلات سابقة", "No previous trips")}</p>;
                      return (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {historyShipments.map(sh => (
                            <div key={sh.id} className="p-2 rounded-lg border border-border/40 space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold">{sh.id}</span>
                                <span className="text-muted-foreground">{fmtDate(sh.date)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                <Route className="w-2.5 h-2.5" />
                                {sh.stops.map((st, i) => <span key={st.invoiceId}>{st.customerName}{i < sh.stops.length - 1 ? " ← " : ""}</span>)}
                              </div>
                              <div className="flex items-center gap-2 text-[9px]">
                                <Weight className="w-2.5 h-2.5 text-muted-foreground" />
                                <span className="font-medium">{fmtNum(sh.totalWeight)} {t("ط", "T")}</span>
                                <MapPin className="w-2.5 h-2.5 text-muted-foreground mr-1" />
                                <span className="text-muted-foreground">{sh.stops.map(s => s.governorate || s.region).filter(Boolean).join("، ")}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Expenses section */}
              <div className="rounded-xl border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Wallet className="w-4 h-4 text-primary" />
                    {t("المصروفات", "Expenses")}
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 rounded-lg"
                    onClick={() => { setExpenseDesc(""); setExpenseAmount(""); setExpenseCat(""); setExpenseDate(new Date().toISOString().split("T")[0]); setExpenseOpen(true); }}>
                    <Plus className="w-3 h-3" />{t("إضافة", "Add")}
                  </Button>
                </div>
                {(() => {
                  let expenses = selectedV.expenses || [];
                  if (expHistMode === "today") {
                    const td = new Date().toISOString().split("T")[0];
                    expenses = expenses.filter(e => e.date === td);
                  } else if (expHistMode === "custom") {
                    if (expHistDateFrom) expenses = expenses.filter(e => e.date >= expHistDateFrom);
                    if (expHistDateTo) expenses = expenses.filter(e => e.date <= expHistDateTo);
                  }
                  const total = expenses.reduce((s, e) => s + e.amount, 0);
                  return (
                    <div className="space-y-1">
                      {/* Filter bar */}
                      <div className="flex gap-1">
                        {[
                          { id: "all" as const, label: t("الكل", "All") },
                          { id: "today" as const, label: t("اليوم", "Today") },
                          { id: "custom" as const, label: t("مخصص", "Custom") },
                        ].map(f => (
                          <button key={f.id} type="button" onClick={() => {
                            setExpHistMode(f.id);
                            if (f.id === "all") { setExpHistDateFrom(""); setExpHistDateTo(""); }
                            else if (f.id === "today") { const d = new Date().toISOString().split("T")[0]; setExpHistDateFrom(d); setExpHistDateTo(d); }
                          }}
                            className={`px-2.5 py-1 text-[9px] rounded-md border transition-colors ${expHistMode === f.id ? "bg-primary/10 border-primary/30 text-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      {expHistMode === "custom" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <Label className="text-[9px] text-muted-foreground">{t("من", "From")}</Label>
                            <input type="date" value={expHistDateFrom} onChange={e => setExpHistDateFrom(e.target.value)}
                              className="w-full h-7 text-[10px] rounded-md border border-input bg-transparent px-2" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[9px] text-muted-foreground">{t("إلى", "To")}</Label>
                            <input type="date" value={expHistDateTo} onChange={e => setExpHistDateTo(e.target.value)}
                              className="w-full h-7 text-[10px] rounded-md border border-input bg-transparent px-2" />
                          </div>
                        </div>
                      )}
                      {expenses.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-1">{t("لا توجد مصروفات", "No expenses")}</p>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {expenses.map(e => (
                            <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/40">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium">{e.description}</p>
                                <p className="text-[9px] text-muted-foreground">{e.date} {e.category ? `· ${e.category}` : ""}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-bold text-destructive">-{fmtNum(e.amount)}</span>
                                <button type="button" className="text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => { deleteVehicleExpense(selectedV.id, e.id); }}>
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {expenses.length > 0 && (
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/30">
                          <span className="text-muted-foreground">{t("الإجمالي", "Total")}</span>
                          <span className="font-bold text-destructive">-{fmtNum(total)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button variant="outline" className="w-full sm:flex-1 gap-2 rounded-xl" onClick={() => { const v = selectedV; setDetailOpen(false); openEditVehicle(v); }}>
                  <Edit3 className="w-4 h-4" />{t("تعديل", "Edit")}
                </Button>
                {selectedV.status === "available" && (
                  <Button variant="outline" className="w-full sm:flex-1 gap-2 rounded-xl" onClick={() => { setDetailOpen(false); setTab("shipping"); }}>
                    <Package className="w-4 h-4" />{t("شحن", "Ship")}
                  </Button>
                )}
                <Button variant="outline" className="w-full sm:flex-1 gap-2 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => { deleteVehicle(selectedV.id); setDetailOpen(false); }}>
                  <Trash2 className="w-4 h-4" />{t("حذف", "Delete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── EXPENSE DIALOG ─── */}
      <Dialog open={expenseOpen} onOpenChange={v => { if (!v) { setExpenseOpen(false); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("إضافة مصروف", "Add Expense")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("التاريخ", "Date")}</Label>
              <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("البيان", "Description")}</Label>
              <Input value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder={t("مثال: تغيير زيت", "e.g., Oil change")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("المبلغ", "Amount")}</Label>
              <Input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("التصنيف", "Category")} <span className="text-muted-foreground">({t("اختياري", "optional")})</span></Label>
              <SmartInput field="product-name"
                value={expenseCat}
                onChange={setExpenseCat}
                placeholder={t("مثال: صيانة", "e.g., Maintenance")}
                extraSuggestions={[
                  t("صيانة", "Maintenance"),
                  t("وقود", "Fuel"),
                  t("إطارات", "Tires"),
                  t("تأمين", "Insurance"),
                  t("ترخيص", "License"),
                  t("أخرى", "Other"),
                ]}
              />
            </div>
            <Button className="w-full rounded-xl gap-2" disabled={!expenseDesc || !expenseAmount || Number(expenseAmount) <= 0}
              onClick={() => {
                if (!selectedV) return;
                addVehicleExpense(selectedV.id, {
                  date: expenseDate,
                  description: expenseDesc,
                  amount: Number(expenseAmount),
                  category: expenseCat,
                });
                setExpenseOpen(false);
                toast.success(t("تم إضافة المصروف", "Expense added"));
              }}>
              <Plus className="w-4 h-4" />{t("إضافة", "Add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── AI OPTIMIZATION DIALOG ─── */}
      <Dialog open={aiOpen} onOpenChange={v => { if (!v) { setAiOpen(false); setAiDone(false); setAiRunning(false); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              {t("تحسين الشحن بالذكاء الاصطناعي", "AI Shipping Optimization")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            {!aiRunning && !aiDone && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("سيقوم الذكاء الاصطناعي بتحليل الفواتير المحددة وتوزيعها على السيارات المتاحة بناءً على الوزن والمنطقة.", "AI will analyze selected invoices and distribute them across available vehicles based on weight and region.")}
                </p>
                <div className="p-4 bg-muted/30 rounded-xl space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    {t("الفواتير المحددة", "Selected Invoices")}: <strong>{selectedInvoices.size}</strong>
                  </p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Weight className="w-4 h-4 text-primary" />
                    {t("الوزن الإجمالي", "Total Weight")}: <strong>{fmtNum(selectedWeight)}</strong> {t("ط", "T")}
                  </p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    {t("السيارات المتاحة", "Available Vehicles")}: <strong>{availableVehicles.length}</strong>
                  </p>
                </div>
                {availableVehicles.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-destructive p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {t("لا توجد سيارات متاحة للشحن", "No available vehicles for shipping")}
                  </div>
                )}
                <Button className="w-full gap-2 rounded-xl" onClick={runAi} disabled={selectedInvoices.size === 0 || availableVehicles.length === 0}>
                  <Sparkles className="w-4 h-4" />{t("بدء التحسين الذكي", "Start AI Optimization")}
                </Button>
              </motion.div>
            )}

            {/* AI running */}
            {aiRunning && (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-6">
                  <div className="relative w-20 h-20">
                    <motion.div className="absolute inset-0 rounded-full border-4 border-primary/20" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    <motion.div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                    <div className="absolute inset-0 flex items-center justify-center"><Cpu className="w-8 h-8 text-primary" /></div>
                  </div>
                </div>
                <div className="space-y-2">
                  {aiSteps.slice(0, aiStep + 1).map((step, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 ${i < aiStep ? "text-emerald-500" : "text-primary animate-pulse"}`} />
                      <span className={i < aiStep ? "text-muted-foreground" : "text-foreground font-medium"}>{step}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* AI results */}
            {aiDone && aiSuggestions.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-500 font-medium">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{t("تم تحسين التوزيع! إليك الاقتراح:", "Optimization complete! Here's the suggestion:")}</span>
                </div>
                {aiSuggestions.map((sug, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary" />
                        <span className="font-bold text-sm">{sug.vehicleName}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        <Weight className="w-3 h-3 inline mr-1" />{fmtNum(sug.totalWeight)} / {fmtNum(sug.totalWeight + sug.remainingCapacity)} {t("ط", "T")}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />{sug.driverName} {sug.driverPhone ? `| ${sug.driverPhone}` : ""}</p>
                    <div className="space-y-1">
                      {sug.stops.map((stop, j) => (
                        <div key={stop.invoiceId} className="flex items-center gap-2 text-[11px]">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                          <span className="truncate flex-1">{stop.customerName}</span>
                          <span className="font-medium text-muted-foreground">{fmtNum(stop.weightTons)} {t("ط", "T")}</span>
                          <Badge variant="outline" className="text-[8px] h-4 px-1">{stop.region || stop.governorate}</Badge>
                        </div>
                      ))}
                    </div>
                    {sug.remainingCapacity > 0 && (
                      <p className="text-[9px] text-muted-foreground flex items-center gap-1 pt-1 border-t border-border/30">
                        <Gauge className="w-3 h-3" />{t("المتبقي", "Remaining")}: {fmtNum(sug.remainingCapacity)} {t("ط", "T")}
                      </p>
                    )}
                  </motion.div>
                ))}
                <Button className="w-full gap-2 rounded-xl" onClick={confirmSuggestions} disabled={confirming}>
                  {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {t("تأكيد وتعيين الشحنات", "Confirm & Assign Shipments")}
                </Button>
              </motion.div>
            )}

            {aiDone && aiSuggestions.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t("لم يتم العثور على توزيع مناسب", "No suitable distribution found")}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* ─── DELIVERY CONFIRMATION DIALOG ─── */}
      <Dialog open={!!deliverConfirmId} onOpenChange={v => { if (!v) setDeliverConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("تأكيد التسليم", "Confirm Delivery")}</DialogTitle>
          </DialogHeader>
          {deliverConfirmId && (() => {
            const veh = vehicles.find(v => v.id === deliverConfirmId);
            if (!veh) return null;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><Truck className="w-6 h-6" /></div>
                  <div>
                    <p className="font-bold text-sm">{veh.name}</p>
                    <p className="text-[10px] text-muted-foreground">{veh.driver}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t("هل تم تسليم جميع شحنات هذه المركبة؟", "Have all shipments on this vehicle been delivered?")}</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="w-full sm:flex-1 gap-2 rounded-xl" onClick={() => {
                    const vehId = deliverConfirmId;
                    setDeliverConfirmId(null);
                    const actives = shipments.filter(s => s.vehicleId === vehId && s.status !== "delivered");
                    if (actives.length > 0) { actives.forEach(s => updateShipment(s.id, { status: "delivered" })); }
                    else { updateVehicle(vehId, { status: "available" }); }
                    toast.success(t("تم تأكيد التسليم", "Delivery confirmed"));
                  }}>
                    <CheckCircle2 className="w-4 h-4" />{t("تأكيد", "Confirm")}
                  </Button>
                  <Button variant="outline" className="w-full sm:flex-1 rounded-xl" onClick={() => setDeliverConfirmId(null)}>{t("إلغاء", "Cancel")}</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── MANUAL ASSIGNMENT DIALOG ─── */}
      <Dialog open={manualOpen} onOpenChange={v => { if (!v) { setManualOpen(false); setManualVehIds(new Set()); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {t("تعيين يدوي للشحن", "Manual Shipment Assignment")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/30 rounded-xl space-y-1">
              <p className="text-xs text-muted-foreground">{t("الفواتير المحددة", "Selected Invoices")}</p>
              <p className="text-sm font-bold">{selectedInvoices.size} {t("فاتورة", "invoice")} — {fmtNum(selectedWeight)} {t("ط", "T")}</p>
            </div>

            {/* Multi-vehicle selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("اختر المركبات", "Select Vehicles")}</Label>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {vehicles.filter(v => v.status === "available").map(v => {
                  const currentLoad = shipments.filter(s => s.vehicleId === v.id && s.status !== "delivered").reduce((s, sh) => s + sh.totalWeight, 0);
                  const remaining = v.maxCapacity - currentLoad;
                  const checked = manualVehIds.has(v.id);
                  return (
                    <div key={v.id} onClick={() => { const next = new Set(manualVehIds); if (checked) next.delete(v.id); else next.add(v.id); setManualVehIds(next); }}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "border-border/60 hover:bg-muted/20"}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{v.name}</p>
                        <p className="text-[9px] text-muted-foreground">{v.driver}</p>
                      </div>
                      <div className="text-end text-[10px]">
                        <p className="font-medium">{fmtNum(remaining)} {t("ط", "T")}</p>
                        <p className="text-muted-foreground">{t("متبقي", "Remaining")}</p>
                      </div>
                    </div>
                  );
                })}
                {vehicles.filter(v => v.status === "available").length === 0 && (
                  <p className="text-[10px] text-muted-foreground py-2 text-center">{t("لا توجد مركبات متاحة", "No available vehicles")}</p>
                )}
              </div>
            </div>

            {/* Capacity summary for selected */}
            {manualVehIds.size > 0 && (() => {
              const totalRemaining = [...manualVehIds].reduce((sum, id) => {
                const veh = vehicles.find(v => v.id === id);
                if (!veh) return sum;
                const load = shipments.filter(s => s.vehicleId === id && s.status !== "delivered").reduce((s, sh) => s + sh.totalWeight, 0);
                return sum + (veh.maxCapacity - load);
              }, 0);
              const fits = selectedWeight <= totalRemaining;
              return (
                <div className="p-3 rounded-xl space-y-1 text-xs" style={{ backgroundColor: fits ? "rgb(16 185 129 / 0.08)" : "rgb(239 68 68 / 0.08)", border: `1px solid ${fits ? "rgb(16 185 129 / 0.2)" : "rgb(239 68 68 / 0.2)"}` }}>
                  <p className="flex items-center gap-2"><Truck className="w-3.5 h-3.5" />{t("المركبات المحددة", "Selected Vehicles")}: {manualVehIds.size}</p>
                  <p className="flex items-center gap-2"><Gauge className="w-3.5 h-3.5" />{t("إجمالي الحمولة المتاحة", "Total Available Capacity")}: {fmtNum(totalRemaining)} {t("ط", "T")}</p>
                  <p className={fits ? "text-emerald-500 font-medium" : "text-destructive font-medium"}>
                    {fits ? t("الوزن مناسب للمركبات ✓", "Weight fits selected vehicles ✓") : t("الوزن يتجاوز الحمولة المتاحة!", "Weight exceeds available capacity!")}
                  </p>
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button className="w-full sm:flex-1 h-11 rounded-xl gap-2" disabled={manualVehIds.size === 0} onClick={() => {
                const selectedInvData = invoices.filter(inv => selectedInvoices.has(inv.id));
                const vehList = [...manualVehIds].map(id => vehicles.find(v => v.id === id)).filter(Boolean) as FleetVehicle[];

                // Distribute invoices across vehicles: assign each invoice to a vehicle with remaining capacity
                const allStops: ShipmentStop[] = selectedInvData.map(inv => {
                  const cust = customers.find(c => c.id === inv.customerId);
                  return {
                    invoiceId: inv.id, customerId: inv.customerId, customerName: inv.customerName,
                    customerPhone: inv.customerPhone,
                    governorate: inv.deliveryAddress?.governorate || cust?.governorate || "",
                    region: inv.deliveryAddress?.region || cust?.region || "",
                    address: inv.deliveryAddress?.details || cust?.address || "",
                    weightTons: inv.items.reduce((s, item) => s + item.qtyTons, 0),
                    ...(inv.deliveryAddress?.village ? { village: inv.deliveryAddress.village } : {}),
                  };
                });
                let remainingStops = allStops;

                for (const veh of vehList) {
                  if (remainingStops.length === 0) break;
                  let currentLoad = shipments.filter(s => s.vehicleId === veh.id && s.status !== "delivered").reduce((s, sh) => s + sh.totalWeight, 0);
                  let capacity = veh.maxCapacity - currentLoad;
                  if (capacity <= 0) continue;
                  const assignStops: ShipmentStop[] = [];
                  const unassigned: ShipmentStop[] = [];
                  for (const stop of remainingStops) {
                    if (stop.weightTons <= capacity) {
                      assignStops.push(stop);
                      capacity -= stop.weightTons;
                    } else {
                      unassigned.push(stop);
                    }
                  }
                  if (assignStops.length === 0 && remainingStops.length > 0) {
                    assignStops.push(remainingStops[0]);
                    remainingStops.splice(0, 1);
                  } else {
                    remainingStops = unassigned;
                  }
                  if (assignStops.length > 0) {
                    const totalW = assignStops.reduce((s, st) => s + st.weightTons, 0);
                    addShipment({
                      id: `SHP-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
                      vehicleId: veh.id, vehicleName: veh.name, driverName: veh.driver, driverPhone: veh.driverPhone,
                      stops: assignStops, totalWeight: totalW, status: "pending",
                      date: new Date().toISOString().split("T")[0],
                    });
                  }
                }
                setSelectedInvoices(new Set());
                setManualOpen(false);
                setManualVehIds(new Set());
                toast.success(t("تم إنشاء الشحنات", "Shipments created"));
              }}>
                <CheckCircle2 className="w-4 h-4" />{t("تعيين الشحنات", "Assign Shipments")}
              </Button>
              <Button variant="outline" className="w-full sm:w-auto h-11 rounded-xl px-6" onClick={() => { setManualOpen(false); setManualVehIds(new Set()); }}>{t("إلغاء", "Cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── FLEET REPORT DIALOG ─── */}
      <Dialog open={repOpen} onOpenChange={v => { if (!v) { setRepOpen(false); setRepGenerated(false); setRepDateMode("all"); setRepDateFrom(""); setRepDateTo(""); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {t("تقرير الناقلات", "Fleet Report")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Period */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("الفترة", "Period")}</Label>
              <div className="flex gap-1">
                {[
                  { id: "all" as DateMode, label: t("الكل", "All") },
                  { id: "today" as DateMode, label: t("اليوم", "Today") },
                  { id: "range" as DateMode, label: t("مدة", "Range") },
                ].map(f => (
                  <button key={f.id} type="button" onClick={() => setRepDateMode(f.id)}
                    className={`px-3 py-1.5 text-[11px] rounded-lg border transition-colors ${repDateMode === f.id ? "bg-primary/10 border-primary/30 text-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {repDateMode === "range" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("من", "From")}</Label>
                  <input type="date" value={repDateFrom} onChange={e => setRepDateFrom(e.target.value)}
                    className="w-full h-9 text-xs rounded-lg border border-input bg-transparent px-2" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{t("إلى", "To")}</Label>
                  <input type="date" value={repDateTo} onChange={e => setRepDateTo(e.target.value)}
                    className="w-full h-9 text-xs rounded-lg border border-input bg-transparent px-2" />
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("الأقسام", "Sections")}</Label>
              <div className="space-y-1">
                {[
                  { id: "repSummary", label: t("الملخص", "Summary"), state: repSummary, set: setRepSummary },
                  { id: "repVehicles", label: t("أداء الناقلات", "Vehicle Performance"), state: repVehicles, set: setRepVehicles },
                  { id: "repShipments", label: t("قائمة الشحنات", "Shipments List"), state: repShipments, set: setRepShipments },
                ].map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input type="checkbox" id={s.id} checked={s.state} onChange={() => s.set(!s.state)}
                      className="w-3.5 h-3.5 rounded border-muted-foreground/30 text-primary" />
                    <label htmlFor={s.id} className="text-xs cursor-pointer">{s.label}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate */}
            {!repGenerated && !repGenerating && (
              <Button className="w-full gap-2 rounded-xl" onClick={handleGenerateFleetReport}
                disabled={repDateMode === "range" && !repDateFrom && !repDateTo}>
                <BarChart3 className="w-4 h-4" />{t("إنشاء التقرير", "Generate Report")}
              </Button>
            )}

            {/* Generating */}
            {repGenerating && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t("جاري إنشاء التقرير...", "Generating report...")}</span>
              </div>
            )}

            {/* Generated */}
            {repGenerated && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-500 font-medium text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{t("تم إنشاء التقرير!", "Report generated!")}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Button className="w-full gap-2 rounded-xl" onClick={handleDownloadFleetPDF}>
                    <Download className="w-4 h-4" />{t("تحميل PDF", "Download PDF")}
                  </Button>
                  <Button variant="outline" className="w-full gap-2 rounded-xl" onClick={() => { setRepOpen(false); setRepGenerated(false); }}>
                    {t("إغلاق", "Close")}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
