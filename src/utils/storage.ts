import type { Video, Course, Category, StudyRecord, Settings, StudyStats, Sentence, PlaylistData } from '../types';
import { 
  saveVideoToIndexedDB, 
  getVideoFromIndexedDB, 
  deleteVideoFromIndexedDB,
} from './indexedDB';
import { 
  uploadToGitHub, 
  addVideoToPlaylist, 
  loadPlaylistFromGitHub, 
  removeVideoFromPlaylist,
  addCourseToPlaylist,
  removeCourseFromPlaylist,
} from './githubUpload';

const STORAGE_KEYS = {
  VIDEOS: 'elp_videos',
  COURSES: 'elp_courses',
  RECORDS: 'elp_records',
  SETTINGS: 'elp_settings',
  ADMIN_TOKEN: 'elp_admin_token',
  ADMIN_PASSWORD: 'elp_admin_password',
};

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
  courses: {
    list: async (): Promise<{ success: boolean; data: Course[] }> => {
      const { courses } = await loadPlaylistFromGitHub();
      return { success: true, data: courses };
    },

    get: async (id: number): Promise<{ success: boolean; data?: Course; error?: string }> => {
      const { courses } = await loadPlaylistFromGitHub();
      const course = courses.find(c => c.id === id);
      if (course) {
        return { success: true, data: course };
      }
      return { success: false, error: '课程不存在' };
    },

    create: async (title: string, description: string = '', icon: string = '📚'): Promise<{ success: boolean; data?: Course; error?: string }> => {
      const course: Course = {
        id: generateId(),
        title,
        description,
        icon,
        videoIds: [],
        createdAt: new Date().toISOString(),
      };

      const ok = await addCourseToPlaylist(course);
      if (ok) {
        return { success: true, data: course };
      }
      return { success: false, error: '创建课程失败' };
    },

    update: async (id: number, data: Partial<Course>): Promise<{ success: boolean; error?: string }> => {
      const { courses } = await loadPlaylistFromGitHub();
      const index = courses.findIndex(c => c.id === id);
      if (index < 0) {
        return { success: false, error: '课程不存在' };
      }

      const updated = { ...courses[index], ...data };
      const ok = await addCourseToPlaylist(updated);
      return ok ? { success: true } : { success: false, error: '更新失败' };
    },

    delete: async (id: number): Promise<{ success: boolean; error?: string }> => {
      const ok = await removeCourseFromPlaylist(id);
      return ok ? { success: true } : { success: false, error: '删除失败' };
    },

    addVideo: async (courseId: number, videoId: number): Promise<{ success: boolean; error?: string }> => {
      const { courses } = await loadPlaylistFromGitHub();
      const index = courses.findIndex(c => c.id === courseId);
      if (index < 0) {
        return { success: false, error: '课程不存在' };
      }

      if (!courses[index].videoIds.includes(videoId)) {
        courses[index].videoIds.push(videoId);
        const ok = await addCourseToPlaylist(courses[index]);
        return ok ? { success: true } : { success: false, error: '添加视频失败' };
      }
      return { success: true };
    },

    removeVideo: async (courseId: number, videoId: number): Promise<{ success: boolean; error?: string }> => {
      const { courses } = await loadPlaylistFromGitHub();
      const index = courses.findIndex(c => c.id === courseId);
      if (index < 0) {
        return { success: false, error: '课程不存在' };
      }

      courses[index].videoIds = courses[index].videoIds.filter(id => id !== videoId);
      const ok = await addCourseToPlaylist(courses[index]);
      return ok ? { success: true } : { success: false, error: '移除视频失败' };
    },
  },

  videos: {
    list: async (courseId?: number): Promise<{ success: boolean; data: Video[] }> => {
      const { videos, courses } = await loadPlaylistFromGitHub();
      
      // 如果指定了课程，只返回该课程的视频
      if (courseId) {
        const course = courses.find(c => c.id === courseId);
        if (course) {
          const courseVideos = videos.filter(v => course.videoIds.includes(v.id));
          return { success: true, data: courseVideos };
        }
      }
      
      return { success: true, data: videos };
    },

    get: async (id: number): Promise<{ success: boolean; data?: Video; error?: string }> => {
      const { videos } = await loadPlaylistFromGitHub();
      const video = videos.find(v => v.id === id);
      if (video) {
        return { success: true, data: video };
      }
      return { success: false, error: '视频不存在' };
    },

    upload: async (
      file: File,
      title: string,
      description: string,
      courseId?: number,
      onProgress?: (percent: number) => void
    ): Promise<{ success: boolean; data?: Video; error?: string }> => {
      return new Promise(async (resolve) => {
        try {
          if (onProgress) onProgress(5);

          if (onProgress) onProgress(10);
          const uploadResult = await uploadToGitHub(file);
          
          if (!uploadResult.success || !uploadResult.url) {
            resolve({
              success: false,
              error: uploadResult.error || '上传到云端失败，请先在设置中配置 GitHub Token',
            });
            return;
          }
          
          if (onProgress) onProgress(40);

          const videoId = generateId();
          const video: Video = {
            id: videoId,
            title,
            description,
            category: 'course',
            duration: 0,
            fileName: uploadResult.fileName || file.name,
            thumbnail: '',
            createdAt: new Date().toISOString(),
            courseId,
          };

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
          
          if (onProgress) onProgress(60);
          
          if (thumbFile) {
            const thumbUpload = await uploadToGitHub(thumbFile);
            if (thumbUpload.success && thumbUpload.url) {
              video.thumbnail = thumbUpload.url;
            }
          }

          if (onProgress) onProgress(80);

          const playlistOk = await addVideoToPlaylist(video, courseId || (courses.length > 0 ? courses[0].id : undefined));
          
          if (onProgress) onProgress(95);
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

    delete: async (id: number): Promise<{ success: boolean; error?: string }> => {
      try {
        try {
          await deleteVideoFromIndexedDB(id);
        } catch (e) {
          console.warn('删除IndexedDB中的视频失败', e);
        }
        
        const result = await removeVideoFromPlaylist(id);
        return result;
      } catch (e) {
        return { success: false, error: '删除失败' };
      }
    },

    getSentences: async (videoId: number): Promise<{ success: boolean; data: Sentence[]; error?: string }> => {
      try {
        const res = await storageApi.videos.get(videoId);
        if (res.success && res.data && res.data.sentences) {
          return { success: true, data: res.data.sentences };
        }
        return { success: true, data: [] };
      } catch (e) {
        return { success: false, data: [], error: '读取句子失败' };
      }
    },

    saveSentences: async (videoId: number, sentences: Sentence[]): Promise<{ success: boolean; error?: string }> => {
      try {
        const video = await storageApi.videos.get(videoId);
        if (video.success && video.data) {
          video.data.sentences = sentences;
          const ok = await addVideoToPlaylist(video.data);
          return ok ? { success: true } : { success: false, error: '保存失败' };
        }
        return { success: false, error: '视频不存在' };
      } catch (e) {
        return { success: false, error: '保存失败' };
      }
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
      return new Promise(async (resolve) => {
        const { videos } = await loadPlaylistFromGitHub();
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
