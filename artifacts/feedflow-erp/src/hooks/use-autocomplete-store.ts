import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dexieStorage } from "@/lib/dexie-storage";

export interface AutocompleteEntry {
  id: string;
  word: string;
  field: string;
  count: number;
  lastUsed: string;
}

interface AutocompleteState {
  entries: AutocompleteEntry[];
  learnWord: (word: string, field: string) => void;
  updateWord: (id: string, newWord: string) => void;
  forgetWord: (id: string) => void;
  getSuggestions: (query: string, field: string) => string[];
  getGrouped: () => Record<string, AutocompleteEntry[]>;
}

export const useAutocompleteStore = create<AutocompleteState>()(
  persist(
    (set, get) => ({
      entries: [],

      learnWord: (word, field) => {
        const trimmed = word.trim();
        if (!trimmed) return;
        set(s => {
          const existing = s.entries.find(e => e.word === trimmed && e.field === field);
          if (existing) {
            return {
              entries: s.entries.map(e =>
                e.id === existing.id ? { ...e, count: e.count + 1, lastUsed: new Date().toISOString() } : e
              ),
            };
          }
          return {
            entries: [...s.entries, { id: crypto.randomUUID(), word: trimmed, field, count: 1, lastUsed: new Date().toISOString() }],
          };
        });
      },

      updateWord: (id, newWord) => {
        const trimmed = newWord.trim();
        if (!trimmed) return;
        set(s => {
          const target = s.entries.find(e => e.id === id);
          if (!target) return s;
          return {
            entries: s.entries.map(e =>
              e.word === target.word && e.field === target.field
                ? { ...e, word: trimmed }
                : e
            ),
          };
        });
      },

      forgetWord: (id) => {
        set(s => ({ entries: s.entries.filter(e => e.id !== id) }));
      },

      getSuggestions: (query, field) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return get().entries
          .filter(e => e.field === field && e.word.toLowerCase().includes(q))
          .sort((a, b) => b.count - a.count)
          .map(e => e.word)
          .slice(0, 10);
      },

      getGrouped: () => {
        const groups: Record<string, AutocompleteEntry[]> = {};
        for (const e of get().entries) {
          if (!groups[e.field]) groups[e.field] = [];
          groups[e.field].push(e);
        }
        for (const key of Object.keys(groups)) {
          groups[key].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
        }
        return groups;
      },
    }),
    { name: "ff-autocomplete", storage: dexieStorage },
  ),
);
