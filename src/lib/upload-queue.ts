import { openDB, type IDBPDatabase } from "idb";
import type { QueuedUpload } from "@/types/capture";

const DB_NAME = "madeofus-capture-queue";
const STORE_NAME = "uploads";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueUpload(upload: Omit<QueuedUpload, "retryCount" | "maxRetries" | "status" | "createdAt">): Promise<string> {
  const db = await getDB();
  const item: QueuedUpload = {
    ...upload,
    retryCount: 0,
    maxRetries: 3,
    status: "pending",
    createdAt: Date.now(),
  };
  await db.put(STORE_NAME, item);
  return item.id;
}

export async function getQueuedUploads(): Promise<QueuedUpload[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function getPendingUploads(): Promise<QueuedUpload[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.filter((u: QueuedUpload) => u.status === "pending" || u.status === "failed");
}

export async function updateUploadStatus(
  id: string,
  status: QueuedUpload["status"],
  retryCount?: number
): Promise<void> {
  const db = await getDB();
  const item = await db.get(STORE_NAME, id);
  if (item) {
    item.status = status;
    if (retryCount !== undefined) item.retryCount = retryCount;
    await db.put(STORE_NAME, item);
  }
}

export async function removeUpload(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearCompletedUploads(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  const completed = all.filter((u: QueuedUpload) => u.status === "completed");
  for (const item of completed) {
    await db.delete(STORE_NAME, item.id);
  }
}

export async function processUploadQueue(
  uploadFn: (upload: QueuedUpload) => Promise<boolean>
): Promise<{ succeeded: number; failed: number }> {
  const pending = await getPendingUploads();
  let succeeded = 0;
  let failed = 0;

  for (const upload of pending) {
    if (upload.retryCount >= upload.maxRetries) {
      await updateUploadStatus(upload.id, "failed");
      failed++;
      continue;
    }

    await updateUploadStatus(upload.id, "uploading");

    try {
      const success = await uploadFn(upload);
      if (success) {
        await updateUploadStatus(upload.id, "completed");
        succeeded++;
      } else {
        await updateUploadStatus(upload.id, "failed", upload.retryCount + 1);
        failed++;
      }
    } catch {
      await updateUploadStatus(upload.id, "failed", upload.retryCount + 1);
      failed++;
    }

    // Small delay between uploads to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return { succeeded, failed };
}
