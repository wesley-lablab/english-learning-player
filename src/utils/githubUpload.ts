import type { Video, Course, Sentence, PlaylistData } from '../types';

const GITHUB_SETTINGS_KEY = 'elp_github_settings';

interface GitHubSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

const DEFAULT_SETTINGS: GitHubSettings = {
  token: '',
  owner: 'wesley-lablab',
  repo: 'english-learning-player',
  branch: 'gh-pages',
  path: 'videos',
};

// 部署后的静态资源路径（GitHub Pages）
const DEPLOY_BRANCH = 'gh-pages';
const DEPLOY_PATH = 'videos';

function getGitHubSettings(): GitHubSettings {
  try {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const urlToken = urlParams.get('token');
    if (urlToken) {
      const settings = { ...DEFAULT_SETTINGS, token: urlToken };
      localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(settings));
      return settings;
    }
  } catch {}
  
  try {
    const saved = localStorage.getItem(GITHUB_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveGitHubSettings(settings: Partial<GitHubSettings>): void {
  try {
    const current = getGitHubSettings();
    localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
  } catch {}
}

export function getGitHubToken(): string {
  return getGitHubSettings().token;
}

function getOwner(): string {
  return getGitHubSettings().owner;
}

function getRepo(): string {
  return getGitHubSettings().repo;
}

function getBranch(): string {
  return getGitHubSettings().branch;
}

function getPath(): string {
  return getGitHubSettings().path;
}

const API_BASE = 'https://api.github.com';

export interface UploadResult {
  success: boolean;
  url?: string;
  fileName?: string;
  error?: string;
}

function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop() || 'mp4';
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
  return `${timestamp}_${random}_${baseName}.${ext}`;
}

function getRawUrl(fileName: string): string {
  return `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${DEPLOY_BRANCH}/${DEPLOY_PATH}/${fileName}`;
}

export function getPublicVideoUrl(fileName: string): string {
  return getRawUrl(fileName);
}

async function getFileSha(path: string): Promise<string | null> {
  const token = getGitHubToken();
  try {
    const response = await fetch(
      `${API_BASE}/repos/${getOwner()}/${getRepo()}/contents/${path}`,
      {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    if (response.ok) {
      const data = await response.json();
      return data.sha || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function putFile(path: string, content: string, message: string, sha?: string): Promise<boolean> {
  const token = getGitHubToken();
  try {
    const response = await fetch(
      `${API_BASE}/repos/${getOwner()}/${getRepo()}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message,
          content,
          branch: getBranch(),
          ...(sha ? { sha } : {})
        })
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function uploadToGitHub(file: File): Promise<UploadResult> {
  const token = getGitHubToken();
  const owner = getOwner();
  const repo = getRepo();
  if (!token || !owner || !repo) {
    return {
      success: false,
      error: 'GitHub 配置不完整，请在家长端设置中配置 Token'
    };
  }

  const fileName = generateFileName(file.name);
  const path = `${getPath()}/${fileName}`;
  const url = getRawUrl(fileName);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const existingSha = await getFileSha(path);
    const success = await putFile(
      path,
      base64Content,
      `Upload: ${fileName}`,
      existingSha || undefined
    );

    if (!success) {
      return { success: false, error: '上传到云端失败' };
    }

    return { success: true, url, fileName };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: `上传失败: ${error instanceof Error ? error.message : '未知错误'}`
    };
  }
}

// 加载完整的播放列表（包含课程和视频）
export async function loadPlaylistFromGitHub(): Promise<{ courses: Course[]; videos: Video[] }> {
  try {
    const playlistRawUrl = `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${DEPLOY_BRANCH}/${DEPLOY_PATH}/playlist.json?t=${Date.now()}`;
    const response = await fetch(playlistRawUrl);
    if (!response.ok) return { courses: [], videos: [] };
    
    const data: PlaylistData = await response.json();
    
    const videos = data.videos.map(v => ({
      ...v,
      fileDataUrl: `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${DEPLOY_BRANCH}/${DEPLOY_PATH}/${v.fileName}`,
      thumbnail: v.thumbnail ? `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${DEPLOY_BRANCH}/${DEPLOY_PATH}/${v.thumbnail}` : '',
    }));
    
    return {
      courses: data.courses || [],
      videos,
    };
  } catch (e) {
    console.warn('加载 playlist 失败', e);
    return { courses: [], videos: [] };
  }
}

// 获取单个视频
export async function getVideoFromPlaylist(videoId: number): Promise<Video | null> {
  const { videos } = await loadPlaylistFromGitHub();
  return videos.find(v => v.id === videoId) || null;
}

// 添加视频到播放列表
export async function addVideoToPlaylist(video: Video): Promise<boolean> {
  const token = getGitHubToken();
  if (!token) return false;

  try {
    const playlistPath = `${getPath()}/playlist.json`;
    const sha = await getFileSha(playlistPath);
    
    let playlist: PlaylistData = { courses: [], videos: [] };
    
    if (sha) {
      const response = await fetch(
        `${API_BASE}/repos/${getOwner()}/${getRepo()}/contents/${playlistPath}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        const decoded = atob(data.content);
        playlist = JSON.parse(decoded);
      }
    }

    const existingIndex = playlist.videos.findIndex(v => v.id === video.id);
    if (existingIndex >= 0) {
      playlist.videos[existingIndex] = { ...video, isPreset: true };
    } else {
      playlist.videos.push({ ...video, isPreset: true });
    }

    const jsonContent = JSON.stringify(playlist, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));
    
    return await putFile(
      playlistPath,
      base64Content,
      `Update playlist: add ${video.title}`,
      sha || undefined
    );
  } catch (e) {
    console.error('更新 playlist 失败:', e);
    return false;
  }
}

// 从播放列表删除视频
export async function removeVideoFromPlaylist(videoId: number): Promise<boolean> {
  const token = getGitHubToken();
  if (!token) return false;

  try {
    const playlistPath = `${getPath()}/playlist.json`;
    const sha = await getFileSha(playlistPath);
    
    if (!sha) return true;
    
    const response = await fetch(
      `${API_BASE}/repos/${getOwner()}/${getRepo()}/contents/${playlistPath}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (!response.ok) return false;
    
    const data = await response.json();
    const decoded = atob(data.content);
    const playlist: PlaylistData = JSON.parse(decoded);
    
    // 从 videos 删除
    playlist.videos = playlist.videos.filter(v => v.id !== videoId);
    
    // 从所有课程的 videoIds 中删除
    playlist.courses = playlist.courses.map(c => ({
      ...c,
      videoIds: c.videoIds.filter(id => id !== videoId)
    })).filter(c => c.videoIds.length > 0);
    
    const jsonContent = JSON.stringify(playlist, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));
    
    return await putFile(
      playlistPath,
      base64Content,
      `Remove video from playlist: ${videoId}`,
      sha
    );
  } catch (e) {
    console.error('从 playlist 删除视频失败:', e);
    return false;
  }
}

// 添加课程
export async function addCourseToPlaylist(course: Course): Promise<boolean> {
  const token = getGitHubToken();
  if (!token) return false;

  try {
    const playlistPath = `${getPath()}/playlist.json`;
    const sha = await getFileSha(playlistPath);
    
    let playlist: PlaylistData = { courses: [], videos: [] };
    
    if (sha) {
      const response = await fetch(
        `${API_BASE}/repos/${getOwner()}/${getRepo()}/contents/${playlistPath}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        const decoded = atob(data.content);
        playlist = JSON.parse(decoded);
      }
    }

    const existingIndex = playlist.courses.findIndex(c => c.id === course.id);
    if (existingIndex >= 0) {
      playlist.courses[existingIndex] = course;
    } else {
      playlist.courses.push(course);
    }

    const jsonContent = JSON.stringify(playlist, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));
    
    return await putFile(
      playlistPath,
      base64Content,
      `Update playlist: add course ${course.title}`,
      sha || undefined
    );
  } catch (e) {
    console.error('更新 playlist 失败:', e);
    return false;
  }
}

// 删除课程
export async function removeCourseFromPlaylist(courseId: number): Promise<boolean> {
  const token = getGitHubToken();
  if (!token) return false;

  try {
    const playlistPath = `${getPath()}/playlist.json`;
    const sha = await getFileSha(playlistPath);
    
    if (!sha) return true;
    
    const response = await fetch(
      `${API_BASE}/repos/${getOwner()}/${getRepo()}/contents/${playlistPath}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (!response.ok) return false;
    
    const data = await response.json();
    const decoded = atob(data.content);
    const playlist: PlaylistData = JSON.parse(decoded);
    
    playlist.courses = playlist.courses.filter(c => c.id !== courseId);
    
    const jsonContent = JSON.stringify(playlist, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));
    
    return await putFile(
      playlistPath,
      base64Content,
      `Remove course from playlist: ${courseId}`,
      sha
    );
  } catch (e) {
    console.error('从 playlist 删除课程失败:', e);
    return false;
  }
}

// 更新播放列表（保存整个列表）
export async function savePlaylist(playlist: PlaylistData): Promise<boolean> {
  const token = getGitHubToken();
  if (!token) return false;

  try {
    const playlistPath = `${getPath()}/playlist.json`;
    const sha = await getFileSha(playlistPath);
    
    const jsonContent = JSON.stringify(playlist, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));
    
    return await putFile(
      playlistPath,
      base64Content,
      `Save playlist`,
      sha || undefined
    );
  } catch (e) {
    console.error('保存 playlist 失败:', e);
    return false;
  }
}
