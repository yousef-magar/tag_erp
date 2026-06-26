import { db as dexieDb } from "@/lib/dexie-storage";

const DB_NAME = "FeedFlowERP";
const DB_VERSION = 2;
const STORE_NAME = "backup";
const AUTO_BACKUP_KEY = "feedflow-auto-backup";
const LAST_BACKUP_KEY = "feedflow-last-backup";
const FOLDER_BACKUP_LAST_TIME_KEY = "feedflow-folder-backup-last-time";
const FOLDER_BACKUP_INTERVAL_KEY = "feedflow-folder-backup-interval";

export interface BackupInfo {
  id: string;
  timestamp: string;
  keyCount: number;
  sizeBytes: number;
  autoBackup?: boolean;
}

interface BackupRecord extends BackupInfo {
  data: Record<string, any>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllStorageKeys(): string[] {
  return Object.keys(localStorage).filter(k => k.startsWith("ff-") || k.startsWith("feedflow-"));
}

function snapshotStorage(): Record<string, any> {
  const keys = getAllStorageKeys();
  const data: Record<string, any> = {};
  keys.forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k) || ""); }
    catch { data[k] = localStorage.getItem(k); }
  });
  return data;
}

function estimateSize(obj: Record<string, any>): number {
  try { return new Blob([JSON.stringify(obj)]).size; }
  catch { return 0; }
}

export async function createBackup(autoBackup = false): Promise<BackupInfo> {
  const data = snapshotStorage();
  const keyCount = Object.keys(data).length;
  const sizeBytes = estimateSize(data);
  const id = `bak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const backup: BackupRecord = {
    id, keyCount, sizeBytes, autoBackup,
    timestamp: new Date().toISOString(),
    data,
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(backup);
    tx.oncomplete = () => {
      db.close();
      localStorage.setItem(LAST_BACKUP_KEY, id);
      resolve({ id, timestamp: backup.timestamp, keyCount, sizeBytes, autoBackup });
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function listBackups(): Promise<BackupInfo[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result
        .map((r: BackupRecord) => ({ id: r.id, timestamp: r.timestamp, keyCount: r.keyCount, sizeBytes: r.sizeBytes, autoBackup: r.autoBackup }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function restoreBackup(id: string): Promise<void> {
  const db = await openDB();
  const backup: BackupRecord | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
  if (!backup) throw new Error("النسخة الاحتياطية غير موجودة");
  Object.entries(backup.data).forEach(([key, val]) => {
    localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val));
  });
  window.location.reload();
}

export async function deleteBackup(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const KNOWN_ACCOUNT_KEYS = [
  "feedflow-banks", "feedflow-wallets", "feedflow-treasury",
  "feedflow-expense-categories", "feedflow-treasury-backup",
];

export async function resetAllData(preserveBackups = true): Promise<void> {
  // Clear ALL localStorage ff-* / feedflow-* keys
  getAllStorageKeys().forEach(k => localStorage.removeItem(k));
  // Also clear known account keys explicitly (belt-and-suspenders)
  KNOWN_ACCOUNT_KEYS.forEach(k => localStorage.removeItem(k));
  sessionStorage.clear();

  // Clear ALL Dexie tables
  const tables = dexieDb.tables.map(t => t.name);
  await Promise.allSettled(tables.map(name => dexieDb.table(name).clear()));

  // Small delay to let any pending persist writes settle, then clear again
  await new Promise(r => setTimeout(r, 100));
  await Promise.allSettled(tables.map(name => dexieDb.table(name).clear()));

  // Clear the backup IndexedDB store
  if (!preserveBackups) {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    } catch (err) {
      console.error("Failed to clear backup store:", err);
    }
  }
}

export async function exportAsJSON(): Promise<Blob> {
  const data = snapshotStorage();
  const backup = {
    app: "FeedFlow ERP",
    version: 1,
    exportedAt: new Date().toISOString(),
    keyCount: Object.keys(data).length,
    data,
  };
  return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
}

export async function importFromJSON(file: File): Promise<{ keysRestored: number }> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed.app !== "FeedFlow ERP") throw new Error("ملف غير صالح");
  if (!parsed.data || typeof parsed.data !== "object") throw new Error("لا توجد بيانات في الملف");
  const entries = Object.entries(parsed.data) as [string, any][];
  entries.forEach(([key, val]) => {
    localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val));
  });
  return { keysRestored: entries.length };
}

export function isAutoBackupEnabled(): boolean {
  return localStorage.getItem(AUTO_BACKUP_KEY) === "true";
}

export function setAutoBackupEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_BACKUP_KEY, enabled ? "true" : "false");
}

const AUTO_BACKUP_INTERVAL_KEY = "feedflow-auto-backup-interval";

export function getAutoBackupIntervalMs(): number {
  const stored = localStorage.getItem(AUTO_BACKUP_INTERVAL_KEY);
  return stored ? parseInt(stored) : 6 * 3600000;
}

export function setAutoBackupIntervalMs(ms: number): void {
  localStorage.setItem(AUTO_BACKUP_INTERVAL_KEY, ms.toString());
}

export function getLastBackupId(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY);
}

// ── All-data snapshot (localStorage + Dexie) ──
export async function snapshotAllData(): Promise<Record<string, any>> {
  const data = snapshotStorage();
  const allKv = await dexieDb.kv.toArray();
  allKv.forEach(item => {
    try { data[`dexie:${item.key}`] = JSON.parse(item.value); }
    catch { data[`dexie:${item.key}`] = item.value; }
  });
  return data;
}

// ── Backup-directory management ──
export async function getBackupDirectories(): Promise<import("@/lib/dexie-storage").BackupDirRecord[]> {
  return dexieDb.backupDirs.toArray();
}

export async function addBackupDirectory(name: string, handle: FileSystemDirectoryHandle): Promise<number> {
  return dexieDb.backupDirs.put({ name, handle });
}

export async function removeBackupDirectory(id: number): Promise<void> {
  await dexieDb.backupDirs.delete(id);
}

// ── Folder backup (File System Access API) ──
export async function saveBackupToDirectories(): Promise<string[]> {
  const dirs = await getBackupDirectories();
  if (dirs.length === 0) return [];

  const allData = await snapshotAllData();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `feedflow-full-backup-${timestamp}.json`;

  const saved: string[] = [];
  for (const dir of dirs) {
    try {
      if ((await dir.handle.queryPermission({ mode: "readwrite" })) !== "granted") {
        const result = await dir.handle.requestPermission({ mode: "readwrite" });
        if (result !== "granted") continue;
      }
      const fileHandle = await dir.handle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      const backup = {
        app: "FeedFlow ERP",
        version: 2,
        exportedAt: new Date().toISOString(),
        keyCount: Object.keys(allData).length,
        data: allData,
      };
      await writable.write(JSON.stringify(backup, null, 2));
      await writable.close();
      saved.push(filename);
    } catch (err) {
      console.error(`Backup failed for "${dir.name}":`, err);
    }
  }

  localStorage.setItem(FOLDER_BACKUP_LAST_TIME_KEY, Date.now().toString());
  return saved;
}

export function isFolderBackupSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// ── Folder backup schedule ──
export function getFolderBackupIntervalMs(): number {
  const stored = localStorage.getItem(FOLDER_BACKUP_INTERVAL_KEY);
  return stored ? parseInt(stored) : 8 * 60 * 60 * 1000;
}

export function setFolderBackupIntervalMs(ms: number): void {
  localStorage.setItem(FOLDER_BACKUP_INTERVAL_KEY, ms.toString());
}

export function getLastFolderBackupTime(): number {
  const stored = localStorage.getItem(FOLDER_BACKUP_LAST_TIME_KEY);
  return stored ? parseInt(stored) : 0;
}

// ── Auto-backup timer (runs while app is open) ──
let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoBackupTimer(): void {
  stopAutoBackupTimer();
  const interval = getFolderBackupIntervalMs();
  autoBackupTimer = setInterval(async () => {
    try {
      const dirs = await getBackupDirectories();
      if (dirs.length > 0) {
        await saveBackupToDirectories();
      }
    } catch (err) {
      console.error("Auto-folder-backup error:", err);
    }
  }, interval);
}

export function stopAutoBackupTimer(): void {
  if (autoBackupTimer !== null) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}

// ── Enhanced runAutoBackupIfNeeded ──
export async function runAutoBackupIfNeeded(): Promise<void> {
  if (!isAutoBackupEnabled()) return;

  // IndexedDB backup (existing)
  const intervalMs = getAutoBackupIntervalMs();
  const lastId = getLastBackupId();
  if (lastId) {
    const backups = await listBackups();
    const last = backups.find(b => b.id === lastId);
    if (last) {
      const msSinceLast = Date.now() - new Date(last.timestamp).getTime();
      if (msSinceLast >= intervalMs) await createBackup(true);
    }
  } else {
    await createBackup(true);
  }

  // Folder backup (new)
  const dirs = await getBackupDirectories();
  if (dirs.length > 0) {
    const lastFolder = getLastFolderBackupTime();
    if (Date.now() - lastFolder >= getFolderBackupIntervalMs()) {
      await saveBackupToDirectories();
    }
  }
}
