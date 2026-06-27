import type { Video, Category, StudyRecord, Settings, StudyStats } from '../types';

const API_BASE = '/api';

function getAuthToken(): string | null {
  return localStorage.getItem('admin_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  const headers = new Headers(options.headers);

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  return response.json();
}

export const api = {
  videos: {
    list: (category?: string) =>
      request<Video[]>(`/videos${category ? `?category=${category}` : ''}`),
    get: (id: number) => request<Video>(`/videos/${id}`),
    upload: async (formData: FormData, onProgress?: (percent: number) => void): Promise<{ success: boolean; data?: Video; error?: string }> => {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        const token = getAuthToken();
        
        xhr.open('POST', '/api/videos');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            resolve({ success: false, error: '服务器响应错误' });
          }
        };

        xhr.onerror = () => {
          resolve({ success: false, error: '网络错误，上传失败' });
        };

        xhr.send(formData);
      });
    },
    update: (id: number, data: Partial<Video>) =>
      request<Video>(`/videos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request(`/videos/${id}`, {
        method: 'DELETE',
      }),
  },
  categories: {
    list: () => request<Category[]>('/categories'),
  },
  auth: {
    login: (password: string) =>
      request<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    logout: () =>
      request('/auth/logout', { method: 'POST' }),
    status: () => request<{ isLoggedIn: boolean }>('/auth/status'),
    getSettings: () => request<Settings>('/auth/settings'),
  },
  records: {
    list: () => request<StudyRecord[]>('/records'),
    add: (data: {
      videoId: number;
      videoTitle: string;
      childName: string;
      watchedDuration: number;
      playbackRate: number;
    }) =>
      request<StudyRecord>('/records', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    stats: () => request<StudyStats>('/stats'),
  },
};
