import type { Video, Sentence } from '../types';

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
  branch: 'main',
  path: 'public/videos',
};

// 部署后的静态资源路径（GitHub Pages）
const DEPLOY_BRANCH = 'gh-pages';
const DEPLOY_PATH = 'videos';

function getGitHubSettings(): GitHubSettings {
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

interface PlaylistVideo {
  id: number;
  title: string;
  description: string;
  category: string;
  duration: number;
  fileName: string;
  fileType: string;
  thumbnail: string;
  createdAt: string;
  isPreset: boolean;
  sentences: Sentence[];
}

interface PlaylistData {
  videos: PlaylistVideo[];
}

function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop() || 'mp4';
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
  return `${timestamp}_${random}_${baseName}.${ext}`;
}

function getRawUrl(fileName: string): string {
  return `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${getBranch()}/${getPath()}/${fileName}`;
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
      `Upload video: ${fileName}`,
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

export async function addVideoToPlaylist(video: Video, sentences: Sentence[]): Promise<boolean> {
  const token = getGitHubToken();
  if (!token) return false;

  try {
    const playlistPath = `${getPath()}/playlist.json`;
    const sha = await getFileSha(playlistPath);
    
    let playlist: PlaylistData = { videos: [] };
    
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

    const playlistVideo: PlaylistVideo = {
      id: video.id,
      title: video.title,
      description: video.description,
      category: video.category,
      duration: video.duration,
      fileName: video.fileName,
      fileType: video.fileType || 'video/mp4',
      thumbnail: video.thumbnail || '',
      createdAt: video.createdAt,
      isPreset: true,
      sentences: sentences || []
    };

    const existingIndex = playlist.videos.findIndex(v => v.id === video.id);
    if (existingIndex >= 0) {
      playlist.videos[existingIndex] = playlistVideo;
    } else {
      playlist.videos.push(playlistVideo);
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
    
    const filtered = playlist.videos.filter(v => v.id !== videoId);
    if (filtered.length === playlist.videos.length) return true;
    
    playlist.videos = filtered;
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

export async function loadPlaylistFromGitHub(): Promise<Video[]> {
  try {
    const playlistRawUrl = `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${DEPLOY_BRANCH}/${DEPLOY_PATH}/playlist.json?t=${Date.now()}`;
    const response = await fetch(playlistRawUrl);
    if (!response.ok) return [];
    
    const data: PlaylistData = await response.json();
    return data.videos.map(v => ({
      ...v,
      fileDataUrl: `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${DEPLOY_BRANCH}/${DEPLOY_PATH}/${v.fileName}`,
      thumbnail: v.thumbnail ? `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${DEPLOY_BRANCH}/${DEPLOY_PATH}/${v.thumbnail}` : '',
      sentences: v.sentences,
    }));
  } catch (e) {
    console.warn('加载 playlist 失败', e);
    return [];
  }
}
