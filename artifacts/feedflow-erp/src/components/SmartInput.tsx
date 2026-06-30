import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { getCompletions, suggestCorrection } from "@/lib/spellcheck";
import { useAutocompleteStore } from "@/hooks/use-autocomplete-store";
import { useAppStore } from "@/hooks/use-app-store";

interface SmartInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "onKeyDown"> {
  value: string;
  onChange: (value: string) => void;
  onAutoCorrect?: (value: string) => void;
  extraSuggestions?: string[];
  showSuggestion?: boolean;
  field?: string;
}

export default function SmartInput({ value, onChange, onAutoCorrect, extraSuggestions = [], placeholder, className, showSuggestion, field, ...rest }: SmartInputProps) {
  const globalShowSuggestion = useAppStore(s => s.showSpellChecker);
  const effectiveShowSuggestion = showSuggestion ?? globalShowSuggestion;
  const [options, setOptions] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [correction, setCorrection] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const learnWord = useAutocompleteStore(s => s.learnWord);
  const getSuggestions = useAutocompleteStore(s => s.getSuggestions);

  useEffect(() => {
    if (value.trim()) {
      const merged = field ? [...new Set([...getSuggestions(value, field), ...getCompletions(value, extraSuggestions)])] : getCompletions(value, extraSuggestions);
      setOptions(merged);
      if (effectiveShowSuggestion) {
        setCorrection(suggestCorrection(value, extraSuggestions));
      }
    } else {
      setOptions([]);
      setCorrection(null);
    }
    setSelectedIdx(-1);
  }, [value, extraSuggestions, effectiveShowSuggestion, field, getSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOptions([]);
        setCorrection(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (options.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, options.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && selectedIdx >= 0) {
        e.preventDefault();
        onChange(options[selectedIdx]);
        setOptions([]);
        setCorrection(null);
        learnWord(options[selectedIdx], field || "");
        return;
      }
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setOptions([]);
      if (field && value.trim()) {
        learnWord(value, field);
      }
    }, 200);
  };

  const applyCorrection = (c: string) => {
    onChange(c);
    setCorrection(null);
    setOptions([]);
    onAutoCorrect?.(c);
    if (field) learnWord(c, field);
  };

  const selectOption = (opt: string) => {
    onChange(opt);
    setOptions([]);
    setCorrection(null);
    if (field) learnWord(opt, field);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={className}
          {...rest}
        />
      </div>
      {correction && effectiveShowSuggestion && correction !== value && (
        <div
          className="mt-1 text-xs text-right text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-primary/10 transition-colors"
          onMouseDown={e => { e.preventDefault(); applyCorrection(correction); }}
        >
          هل تقصد <strong>{correction}</strong>؟
        </div>
      )}
      {options.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-popover shadow-lg max-h-48 overflow-y-auto custom-scrollbar">
          {options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              className={`w-full text-right px-3 py-1.5 text-xs transition-colors hover:bg-muted ${
                i === selectedIdx ? "bg-muted font-medium" : ""
              }`}
              onMouseDown={e => { e.preventDefault(); selectOption(opt); }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
