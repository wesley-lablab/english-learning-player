import type { Video, Category, StudyRecord, Settings, StudyStats } from '../types';
import { 
  saveVideoToIndexedDB, 
  getVideoFromIndexedDB, 
  deleteVideoFromIndexedDB,
  checkStorageAvailable,
  formatBytes 
} from './indexedDB';

const STORAGE_KEYS = {
  VIDEOS: 'elp_videos',
  RECORDS: 'elp_records',
  SETTINGS: 'elp_settings',
  ADMIN_TOKEN: 'elp_admin_token',
  ADMIN_PASSWORD: 'elp_admin_password',
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'course', name: '课程', icon: '📚', color: 'blue', sortOrder: 1 },
  { id: 'extension', name: '课程拓展', icon: '🌟', color: 'purple', sortOrder: 2 },
];

const DEFAULT_SETTINGS: Settings = {
  childName: '小朋友',
  childAvatar: '🧒',
};

const DEFAULT_PASSWORD = '123456';

function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

export const storageApi = {
  videos: {
    list: (category?: string): Promise<{ success: boolean; data: Video[] }> => {
      return new Promise((resolve) => {
        const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
        const filtered = category && category !== 'all'
          ? videos.filter(v => v.category === category)
          : videos;
        resolve({ success: true, data: filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ) });
      });
    },

    upload: async (
      file: File,
      title: string,
      description: string,
      category: string,
      onProgress?: (percent: number) => void
    ): Promise<{ success: boolean; data?: Video; error?: string }> => {
      return new Promise(async (resolve) => {
        try {
          if (onProgress) onProgress(5);
          
          const storageCheck = await checkStorageAvailable(100);
          if (!storageCheck.available) {
            resolve({
              success: false,
              error: `存储空间不足！${storageCheck.message}。请先删除一些旧视频。`,
            });
            return;
          }

          if (onProgress) onProgress(10);

          const isVideo = file.type.startsWith('video/');
          const videoId = generateId();

          const video: Video = {
            id: videoId,
            title,
            description,
            category,
            duration: 0,
            fileName: file.name,
            thumbnail: '',
            createdAt: new Date().toISOString(),
            fileDataUrl: '',
            fileType: file.type,
          };

          if (onProgress) onProgress(30);

          let thumbnailBlob: Blob | undefined;

          if (isVideo) {
            const videoEl = document.createElement('video');
            videoEl.preload = 'auto';
            videoEl.muted = true;
            videoEl.playsInline = true;
            
            let resolved = false;
            const safeResolve = () => {
              if (!resolved) {
                resolved = true;
              }
            };
            
            await new Promise<void>((resolveVideo) => {
              const finish = () => {
                safeResolve();
                resolveVideo();
              };
              
              const timeout = setTimeout(finish, 8000);
              
              videoEl.onloadedmetadata = () => {
                if (resolved) return;
                video.duration = Math.round(videoEl.duration);
                
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 180;
                const ctx = canvas.getContext('2d');
                
                try {
                  const seekTime = Math.min(1, videoEl.duration / 2);
                  videoEl.currentTime = seekTime;
                  
                  videoEl.onseeked = () => {
                    if (resolved) return;
                    try {
                      if (ctx) {
                        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((blob) => {
                          thumbnailBlob = blob || undefined;
                          clearTimeout(timeout);
                          finish();
                        }, 'image/jpeg', 0.7);
                      } else {
                        clearTimeout(timeout);
                        finish();
                      }
                    } catch {
                      clearTimeout(timeout);
                      finish();
                    }
                  };
                  
                  videoEl.onerror = () => {
                    clearTimeout(timeout);
                    finish();
                  };
                  
                } catch {
                  clearTimeout(timeout);
                  finish();
                }
              };
              
              videoEl.onerror = () => {
                clearTimeout(timeout);
                finish();
              };
              
              const objectUrl = URL.createObjectURL(file);
              videoEl.src = objectUrl;
              videoEl.load();
            });
          }

          if (onProgress) onProgress(60);

          try {
            await saveVideoToIndexedDB({
              id: videoId,
              file: file,
              thumbnail: thumbnailBlob,
            });
          } catch (e) {
            resolve({
              success: false,
              error: '存储空间不足，无法保存视频！请删除一些旧视频后再试。',
            });
            return;
          }

          if (onProgress) onProgress(90);

          if (thumbnailBlob) {
            video.thumbnail = URL.createObjectURL(thumbnailBlob);
          } else if (!isVideo) {
            video.thumbnail = URL.createObjectURL(file);
          }

          const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
          videos.push(video);
          saveToStorage(STORAGE_KEYS.VIDEOS, videos);

          if (onProgress) onProgress(100);

          resolve({ success: true, data: video });

        } catch (err) {
          resolve({
            success: false,
            error: '上传失败：' + (err as Error).message,
          });
        }
      });
    },

    get: (id: number): Promise<{ success: boolean; data?: Video; error?: string }> => {
      return new Promise(async (resolve) => {
        try {
          const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
          const video = videos.find(v => v.id === id);
          
          if (!video) {
            resolve({ success: false, error: '视频不存在' });
            return;
          }

          if (!video.fileDataUrl) {
            const stored = await getVideoFromIndexedDB(id);
            if (stored && stored.file) {
              video.fileDataUrl = URL.createObjectURL(stored.file);
              if (stored.thumbnail && !video.thumbnail) {
                video.thumbnail = URL.createObjectURL(stored.thumbnail);
              }
            }
          }

          resolve({ success: true, data: video });
        } catch (err) {
          resolve({ success: false, error: '读取失败' });
        }
      });
    },

    update: (id: number, data: Partial<Video>): Promise<{ success: boolean; data?: Video; error?: string }> => {
      return new Promise((resolve) => {
        const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
        const index = videos.findIndex(v => v.id === id);
        if (index >= 0) {
          videos[index] = { ...videos[index], ...data };
          saveToStorage(STORAGE_KEYS.VIDEOS, videos);
          resolve({ success: true, data: videos[index] });
        } else {
          resolve({ success: false, error: '视频不存在' });
        }
      });
    },

    delete: (id: number): Promise<{ success: boolean; error?: string }> => {
      return new Promise(async (resolve) => {
        try {
          const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
          const filtered = videos.filter(v => v.id !== id);
          saveToStorage(STORAGE_KEYS.VIDEOS, filtered);
          localStorage.removeItem(`sentences_${id}`);
          
          try {
            await deleteVideoFromIndexedDB(id);
          } catch (e) {
            console.warn('删除IndexedDB中的视频失败', e);
          }
          
          resolve({ success: true });
        } catch (e) {
          resolve({ success: false, error: '删除失败' });
        }
      });
    },
  },

  categories: {
    list: (): Promise<{ success: boolean; data: Category[] }> => {
      return new Promise((resolve) => {
        resolve({ success: true, data: DEFAULT_CATEGORIES });
      });
    },
  },

  auth: {
    login: (password: string): Promise<{ success: boolean; data?: { token: string }; error?: string }> => {
      return new Promise((resolve) => {
        const savedPassword = getFromStorage<string>(STORAGE_KEYS.ADMIN_PASSWORD, DEFAULT_PASSWORD);
        if (password === savedPassword) {
          const token = 'admin_' + generateId();
          localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
          resolve({ success: true, data: { token } });
        } else {
          resolve({ success: false, error: '密码错误' });
        }
      });
    },

    logout: (): Promise<{ success: boolean }> => {
      return new Promise((resolve) => {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        resolve({ success: true });
      });
    },

    status: (): Promise<{ success: boolean; data: { isLoggedIn: boolean } }> => {
      return new Promise((resolve) => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        resolve({ success: true, data: { isLoggedIn: !!token } });
      });
    },

    getSettings: (): Promise<{ success: boolean; data: Settings }> => {
      return new Promise((resolve) => {
        const settings = getFromStorage<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
        resolve({ success: true, data: settings });
      });
    },
  },

  records: {
    list: (): Promise<{ success: boolean; data: StudyRecord[] }> => {
      return new Promise((resolve) => {
        const records = getFromStorage<StudyRecord[]>(STORAGE_KEYS.RECORDS, []);
        resolve({
          success: true,
          data: records.sort((a, b) => 
            new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
          ),
        });
      });
    },

    add: (data: {
      videoId: number;
      videoTitle: string;
      childName: string;
      watchedDuration: number;
      playbackRate: number;
    }): Promise<{ success: boolean; data: StudyRecord }> => {
      return new Promise((resolve) => {
        const record: StudyRecord = {
          id: generateId(),
          ...data,
          watchedAt: new Date().toISOString(),
        };
        const records = getFromStorage<StudyRecord[]>(STORAGE_KEYS.RECORDS, []);
        records.push(record);
        saveToStorage(STORAGE_KEYS.RECORDS, records);
        resolve({ success: true, data: record });
      });
    },

    stats: (): Promise<{ success: boolean; data: StudyStats }> => {
      return new Promise((resolve) => {
        const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
        const records = getFromStorage<StudyRecord[]>(STORAGE_KEYS.RECORDS, []);
        const totalDuration = records.reduce((sum, r) => sum + r.watchedDuration, 0);
        resolve({
          success: true,
          data: {
            totalVideos: videos.length,
            totalDuration,
            recordsCount: records.length,
          },
        });
      });
    },
  },
};
