import Dexie, { type Table } from "dexie";

export interface BackupDirRecord {
  id?: number;
  name: string;
  handle: FileSystemDirectoryHandle;
}

class FeedFlowDB extends Dexie {
  kv!: Table<{ key: string; value: string }>;
  backupDirs!: Table<BackupDirRecord>;

  constructor() {
    super("FeedFlowDB");
    this.version(2).stores({
      kv: "key",
      backupDirs: "++id",
    });
  }
}

const db = new FeedFlowDB();

export const dexieStorage = {
  getItem: async <T>(name: string): Promise<{ state: T; version?: number } | null> => {
    const row = await db.kv.get(name);
    if (!row) return null;
    try { return JSON.parse(row.value) as { state: T; version?: number }; } catch { return null; }
  },
  setItem: async <T>(name: string, value: { state: T; version?: number }): Promise<void> => {
    await db.kv.put({ key: name, value: JSON.stringify(value) });
  },
  removeItem: async (name: string): Promise<void> => {
    await db.kv.delete(name);
  },
};

export async function migrateFromLocalStorage(storeNames: string[]) {
  for (const name of storeNames) {
    const existing = await db.kv.get(name);
    if (existing) continue;
    const ls = localStorage.getItem(name);
    if (ls) {
      await db.kv.put({ key: name, value: ls });
    }
  }
}

export { db };
