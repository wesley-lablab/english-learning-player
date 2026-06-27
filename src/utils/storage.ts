import type { Video, Category, StudyRecord, Settings, StudyStats } from '../types';

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

    get: (id: number): Promise<{ success: boolean; data?: Video; error?: string }> => {
      return new Promise((resolve) => {
        const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
        const video = videos.find(v => v.id === id);
        if (video) {
          resolve({ success: true, data: video });
        } else {
          resolve({ success: false, error: '视频不存在' });
        }
      });
    },

    upload: async (
      file: File,
      title: string,
      description: string,
      category: string,
      onProgress?: (percent: number) => void
    ): Promise<{ success: boolean; data?: Video; error?: string }> => {
      return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        reader.onload = (e) => {
          const fileDataUrl = e.target?.result as string;
          const isVideo = file.type.startsWith('video/');
          
          const video: Video = {
            id: generateId(),
            title,
            description,
            category,
            duration: 0,
            fileName: file.name,
            thumbnail: isVideo ? '' : fileDataUrl,
            createdAt: new Date().toISOString(),
            fileDataUrl,
            fileType: file.type,
          } as Video & { fileDataUrl: string; fileType: string };

          const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
          videos.push(video);
          saveToStorage(STORAGE_KEYS.VIDEOS, videos);

          if (isVideo) {
            const videoEl = document.createElement('video');
            videoEl.preload = 'metadata';
            videoEl.onloadedmetadata = () => {
              video.duration = Math.round(videoEl.duration);
              
              const canvas = document.createElement('canvas');
              canvas.width = 320;
              canvas.height = 180;
              const ctx = canvas.getContext('2d');
              
              videoEl.currentTime = Math.min(1, videoEl.duration / 2);
              videoEl.onseeked = () => {
                if (ctx) {
                  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                  video.thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                }
                const allVideos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
                const idx = allVideos.findIndex(v => v.id === video.id);
                if (idx >= 0) {
                  allVideos[idx] = video;
                  saveToStorage(STORAGE_KEYS.VIDEOS, allVideos);
                }
              };
            };
            videoEl.src = fileDataUrl;
          }

          setTimeout(() => {
            resolve({ success: true, data: video });
          }, 300);
        };

        reader.onerror = () => {
          resolve({ success: false, error: '文件读取失败' });
        };

        reader.readAsDataURL(file);
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
      return new Promise((resolve) => {
        const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
        const filtered = videos.filter(v => v.id !== id);
        saveToStorage(STORAGE_KEYS.VIDEOS, filtered);
        resolve({ success: true });
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
