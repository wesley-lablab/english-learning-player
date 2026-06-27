const DB_NAME = 'english-learning-player';
const DB_VERSION = 1;
const STORE_VIDEOS = 'videos';

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('无法打开数据库'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_VIDEOS)) {
        const store = database.createObjectStore(STORE_VIDEOS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };
  });
}

export async function saveVideoToIndexedDB(videoData: {
  id: number;
  file: Blob;
  thumbnail?: Blob;
}): Promise<void> {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_VIDEOS], 'readwrite');
    const store = transaction.objectStore(STORE_VIDEOS);
    
    const request = store.put({
      id: videoData.id,
      file: videoData.file,
      thumbnail: videoData.thumbnail || null,
      createdAt: Date.now(),
    });

    request.onerror = () => reject(new Error('保存视频失败'));
    request.onsuccess = () => resolve();
  });
}

export async function getVideoFromIndexedDB(id: number): Promise<{
  file?: Blob;
  thumbnail?: Blob;
} | null> {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_VIDEOS], 'readonly');
    const store = transaction.objectStore(STORE_VIDEOS);
    const request = store.get(id);

    request.onerror = () => reject(new Error('读取视频失败'));
    request.onsuccess = () => {
      if (request.result) {
        resolve({
          file: request.result.file,
          thumbnail: request.result.thumbnail,
        });
      } else {
        resolve(null);
      }
    };
  });
}

export async function deleteVideoFromIndexedDB(id: number): Promise<void> {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_VIDEOS], 'readwrite');
    const store = transaction.objectStore(STORE_VIDEOS);
    const request = store.delete(id);

    request.onerror = () => reject(new Error('删除视频失败'));
    request.onsuccess = () => resolve();
  });
}

export async function getStorageEstimate(): Promise<{
  used: number;
  quota: number;
  usagePercent: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;
    return {
      used,
      quota,
      usagePercent: quota > 0 ? (used / quota) * 100 : 0,
    };
  }
  return { used: 0, quota: 0, usagePercent: 0 };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function checkStorageAvailable(requiredMB: number = 100): Promise<{
  available: boolean;
  message: string;
  used: number;
  quota: number;
}> {
  const info = await getStorageEstimate();
  const requiredBytes = requiredMB * 1024 * 1024;
  
  if (info.quota > 0) {
    const available = info.quota - info.used;
    if (available >= requiredBytes) {
      return {
        available: true,
        message: `存储空间充足（已用 ${formatBytes(info.used)} / 可用 ${formatBytes(available)}）`,
        used: info.used,
        quota: info.quota,
      };
    } else {
      return {
        available: false,
        message: `存储空间不足！已用 ${formatBytes(info.used)}，需要约 ${requiredMB}MB 空间`,
        used: info.used,
        quota: info.quota,
      };
    }
  }
  
  return {
    available: true,
    message: '无法检测存储空间',
    used: info.used,
    quota: info.quota,
  };
}
