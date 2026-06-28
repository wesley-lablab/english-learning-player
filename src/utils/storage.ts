import type { Video, Category, StudyRecord, Settings, StudyStats, Sentence } from '../types';
import { 
  saveVideoToIndexedDB, 
  getVideoFromIndexedDB, 
  deleteVideoFromIndexedDB,
  checkStorageAvailable,
} from './indexedDB';
import { uploadToGitHub, addVideoToPlaylist, loadPlaylistFromGitHub } from './githubUpload';

const STORAGE_KEYS = {
  VIDEOS: 'elp_videos',
  RECORDS: 'elp_records',
  SETTINGS: 'elp_settings',
  ADMIN_TOKEN: 'elp_admin_token',
  ADMIN_PASSWORD: 'elp_admin_password',
  PRESET_SENTENCES: 'elp_preset_sentences',
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
    list: async (category?: string): Promise<{ success: boolean; data: Video[] }> => {
      // 从 GitHub 加载云端视频
      const cloudVideos = await loadPlaylistFromGitHub();
      
      // 从本地加载
      const localVideos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
      
      const allVideos = [...cloudVideos, ...localVideos];
      const filtered = category && category !== 'all'
        ? allVideos.filter(v => v.category === category)
        : allVideos;
      
      return {
        success: true,
        data: filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      };
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

          // 上传视频到 GitHub
          if (onProgress) onProgress(10);
          const uploadResult = await uploadToGitHub(file);
          
          if (!uploadResult.success || !uploadResult.url) {
            resolve({
              success: false,
              error: uploadResult.error || '上传到云端失败',
            });
            return;
          }
          
          if (onProgress) onProgress(50);

          const videoId = generateId();
          const video: Video = {
            id: videoId,
            title,
            description,
            category,
            duration: 0,
            fileName: uploadResult.fileName || file.name,
            thumbnail: '',
            createdAt: new Date().toISOString(),
            fileDataUrl: uploadResult.url,
            fileType: file.type,
            isCloudHosted: true,
          };

          // 生成缩略图
          let thumbFile: File | undefined;
          if (file.type.startsWith('video/')) {
            const videoEl = document.createElement('video');
            videoEl.preload = 'auto';
            videoEl.muted = true;
            videoEl.playsInline = true;
            
            await new Promise<void>((resolveVideo) => {
              const timeout = setTimeout(resolveVideo, 8000);
              
              videoEl.onloadedmetadata = () => {
                video.duration = Math.round(videoEl.duration);
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 180;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                  const seekTime = Math.min(1, videoEl.duration / 2);
                  videoEl.currentTime = seekTime;
                  
                  videoEl.onseeked = () => {
                    try {
                      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                      canvas.toBlob((blob) => {
                        if (blob) {
                          thumbFile = new File([blob], `thumb_${videoId}.jpg`, { type: 'image/jpeg' });
                        }
                        clearTimeout(timeout);
                        resolveVideo();
                      }, 'image/jpeg', 0.7);
                    } catch {
                      clearTimeout(timeout);
                      resolveVideo();
                    }
                  };
                } else {
                  clearTimeout(timeout);
                  resolveVideo();
                }
              };
              
              videoEl.onerror = () => {
                clearTimeout(timeout);
                resolveVideo();
              };
              
              videoEl.src = uploadResult.url!;
              videoEl.load();
            });
          }
          
          if (onProgress) onProgress(70);
          
          // 上传缩略图
          if (thumbFile) {
            const thumbUpload = await uploadToGitHub(thumbFile);
            if (thumbUpload.success && thumbUpload.url) {
              video.thumbnail = thumbUpload.url;
            }
          }

          if (onProgress) onProgress(85);

          // 保存到 GitHub playlist（多端共享）
          const playlistOk = await addVideoToPlaylist(video, []);
          
          if (onProgress) onProgress(95);

          // 也保存到本地
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
          // 先看云端
          const cloudVideos = await loadPlaylistFromGitHub();
          const cloudVideo = cloudVideos.find(v => v.id === id);
          
          if (cloudVideo) {
            resolve({ success: true, data: cloudVideo });
            return;
          }
          
          // 再看本地
          const videos = getFromStorage<Video[]>(STORAGE_KEYS.VIDEOS, []);
          const video = videos.find(v => v.id === id);
          
          if (!video) {
            resolve({ success: false, error: '视频不存在' });
            return;
          }

          // 云端视频直接用 fileDataUrl
          if (video.fileDataUrl && video.fileDataUrl.startsWith('http')) {
            resolve({ success: true, data: video });
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
      return new Promise(async (resolve) => {
        // 更新本地
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

    getSentences: async (videoId: number): Promise<{ success: boolean; data: Sentence[]; error?: string }> => {
      try {
        // 先看云端
        const cloudVideos = await loadPlaylistFromGitHub();
        const cloudVideo = cloudVideos.find(v => v.id === videoId);
        
        // 本地修改过的优先
        const saved = localStorage.getItem(`sentences_${videoId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) {
            return { success: true, data: parsed };
          }
        }
        
        // 云端有句子的话用云端
        if (cloudVideo && cloudVideo.sentences && cloudVideo.sentences.length > 0) {
          return { success: true, data: cloudVideo.sentences };
        }
        
        return { success: true, data: [] };
      } catch (e) {
        return { success: false, data: [], error: '读取句子失败' };
      }
    },

    saveSentences: (videoId: number, sentences: Sentence[]): Promise<{ success: boolean; error?: string }> => {
      return new Promise(async (resolve) => {
        try {
          localStorage.setItem(`sentences_${videoId}`, JSON.stringify(sentences));
          
          // 同时更新云端 playlist（多端同步）
          const cloudVideos = await loadPlaylistFromGitHub();
          const cloudVideo = cloudVideos.find(v => v.id === videoId);
          if (cloudVideo) {
            await addVideoToPlaylist(cloudVideo, sentences);
          }
          
          resolve({ success: true });
        } catch (e) {
          resolve({ success: false, error: '保存失败' });
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
