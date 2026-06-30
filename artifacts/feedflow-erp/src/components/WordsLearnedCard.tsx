import React, { useState } from "react";
import { useAutocompleteStore, type AutocompleteEntry } from "@/hooks/use-autocomplete-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Book, Plus, Trash2, Save, X, Check, Pencil } from "lucide-react";

const FIELD_LABELS: Record<string, [string, string]> = {
  "product-name": ["اسم المنتج", "Product Name"],
  "material-name": ["اسم الخامة", "Material Name"],
  "customer-name": ["اسم العميل", "Customer Name"],
  "warehouse-name": ["اسم المخزن", "Warehouse Name"],
  "driver-name": ["اسم السائق", "Driver Name"],
  "truck-plate": ["رقم اللوحة", "Truck Plate"],
  "formula-name": ["اسم الخلطة", "Formula Name"],
  "supplier-name": ["اسم المورد", "Supplier Name"],
  "employee-name": ["اسم الموظف", "Employee Name"],
};

function getFieldLabel(field: string, language: "ar" | "en"): string {
  const labels = FIELD_LABELS[field];
  if (labels) return labels[language === "ar" ? 0 : 1];
  return field;
}

export default function WordsLearnedCard({ t, language }: { t: (ar: string, en: string) => string; language: "ar" | "en" }) {
  const entries = useAutocompleteStore(s => s.entries);
  const learnWord = useAutocompleteStore(s => s.learnWord);
  const updateWord = useAutocompleteStore(s => s.updateWord);
  const forgetWord = useAutocompleteStore(s => s.forgetWord);

  const grouped = useAutocompleteStore(s => s.getGrouped)();
  const fields = Object.keys(grouped).sort();

  const [newWord, setNewWord] = useState("");
  const [newField, setNewField] = useState("product-name");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleAdd = () => {
    if (!newWord.trim() || !newField) return;
    learnWord(newWord.trim(), newField);
    setNewWord("");
  };

  const startEdit = (e: AutocompleteEntry) => {
    setEditingId(e.id);
    setEditValue(e.word);
  };

  const saveEdit = (id: string) => {
    if (editValue.trim()) {
      updateWord(id, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <Card className="p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
        <Book className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <h2 className="text-lg font-bold">{t("الكلمات المُتعلَّمة", "Learned Words")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("كلمات تم كتابتها سابقًا — تُستخدم في الاقتراحات التلقائية", "Previously typed words — used for autocomplete suggestions")}
          </p>
        </div>
      </div>

      {/* ── Add new word ── */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Input value={newWord} onChange={e => setNewWord(e.target.value)}
          placeholder={t("كلمة جديدة", "New word")} className="h-8 text-xs w-32" />
        <Select value={newField} onValueChange={setNewField}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.keys(FIELD_LABELS).map(f => (
              <SelectItem key={f} value={f}>{getFieldLabel(f, language)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleAdd}>
          <Plus className="w-3 h-3" />{t("إضافة", "Add")}
        </Button>
      </div>

      {/* ── Grouped words ── */}
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          {t("لم يتم تعلم أي كلمات بعد. ابدأ بالكتابة في أي حقل نصي.", "No words learned yet. Start typing in any input field.")}
        </p>
      ) : (
        <div className="space-y-5">
          {fields.map(field => (
            <div key={field}>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                {getFieldLabel(field, language)}
                <span className="text-[9px] text-muted-foreground/50">({grouped[field].length})</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {grouped[field].map(e => (
                  <motion.div key={e.id} layout className="group relative">
                    {editingId === e.id ? (
                      <div className="flex items-center gap-1 border border-primary/40 rounded-lg px-2 py-1 bg-primary/5">
                        <Input value={editValue} onChange={e => setEditValue(e.target.value)}
                          className="h-6 text-xs w-28 p-1" autoFocus
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(editingId!); if (e.key === "Escape") cancelEdit(); }} />
                        <button onClick={() => saveEdit(e.id)} className="text-emerald-500 hover:text-emerald-600 p-0.5"><Check className="w-3 h-3" /></button>
                        <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1 text-xs bg-card hover:border-primary/30 transition-colors">
                        <span>{e.word}</span>
                        <span className="text-[9px] text-muted-foreground/40" title={new Date(e.lastUsed).toLocaleDateString()}>×{e.count}</span>
                        <button onClick={() => startEdit(e)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5 transition-opacity">
                          <Pencil className="w-3 h-3" />
                        </button>
                        {e.count <= 1 && (
                          <button onClick={() => forgetWord(e.id)} className="opacity-0 group-hover:opacity-100 text-destructive/50 hover:text-destructive p-0.5 transition-opacity">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
