export type PendingWorkoutLog = {
  localId: string;
  workoutId: string;
  workoutDate: string;
  workoutTitle: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type OfflineWorkout = {
  id: string;
  date: string;
  workout_type: string;
  title: string;
  planned_distance_km: number;
  planned_duration_min: number;
  planned_rpe: number | null;
  purpose?: string | null;
  main_set?: string | null;
  completed?: boolean;
  skipped?: boolean;
  log?: unknown;
};

const DB_NAME = "half-marathon-training-offline";
const DB_VERSION = 1;
const PENDING_STORE = "pending_logs";
const RECENT_STORE = "recent_workouts";

function assertBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("当前环境不支持离线存储");
  }
}

function openDatabase(): Promise<IDBDatabase> {
  assertBrowser();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) db.createObjectStore(PENDING_STORE, { keyPath: "localId" });
      if (!db.objectStoreNames.contains(RECENT_STORE)) db.createObjectStore(RECENT_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("打开离线数据库失败"));
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("离线存储事务失败"));
    tx.onabort = () => reject(tx.error ?? new Error("离线存储事务中止"));
  });
}

export async function savePendingWorkoutLog(input: Omit<PendingWorkoutLog, "localId" | "createdAt">) {
  const db = await openDatabase();
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const store = tx.objectStore(PENDING_STORE);
  const item: PendingWorkoutLog = {
    ...input,
    localId: `${input.workoutId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  store.put(item);
  await txDone(tx);
  db.close();
  window.dispatchEvent(new CustomEvent("pending-logs-changed"));
  return item;
}

export async function listPendingWorkoutLogs() {
  const db = await openDatabase();
  const tx = db.transaction(PENDING_STORE, "readonly");
  const request = tx.objectStore(PENDING_STORE).getAll();
  const items = await new Promise<PendingWorkoutLog[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as PendingWorkoutLog[]);
    request.onerror = () => reject(request.error ?? new Error("读取 pending_logs 失败"));
  });
  await txDone(tx);
  db.close();
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removePendingWorkoutLog(localId: string) {
  const db = await openDatabase();
  const tx = db.transaction(PENDING_STORE, "readwrite");
  tx.objectStore(PENDING_STORE).delete(localId);
  await txDone(tx);
  db.close();
  window.dispatchEvent(new CustomEvent("pending-logs-changed"));
}

export async function cacheRecentWorkouts(workouts: OfflineWorkout[]) {
  const db = await openDatabase();
  const tx = db.transaction(RECENT_STORE, "readwrite");
  const store = tx.objectStore(RECENT_STORE);
  for (const workout of workouts) store.put(workout);
  await txDone(tx);
  db.close();
}

export async function getCachedRecentWorkouts() {
  const db = await openDatabase();
  const tx = db.transaction(RECENT_STORE, "readonly");
  const request = tx.objectStore(RECENT_STORE).getAll();
  const items = await new Promise<OfflineWorkout[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as OfflineWorkout[]);
    request.onerror = () => reject(request.error ?? new Error("读取离线训练失败"));
  });
  await txDone(tx);
  db.close();
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export async function clearOfflineData() {
  const db = await openDatabase();
  const tx = db.transaction([PENDING_STORE, RECENT_STORE], "readwrite");
  tx.objectStore(PENDING_STORE).clear();
  tx.objectStore(RECENT_STORE).clear();
  await txDone(tx);
  db.close();
  window.dispatchEvent(new CustomEvent("pending-logs-changed"));
}
