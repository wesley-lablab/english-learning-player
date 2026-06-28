import type { Video, Sentence } from '../types';

const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || 'wesley-lablab';
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'english-learning-player';
const GITHUB_BRANCH = import.meta.env.VITE_GITHUB_BRANCH || 'main';
const GITHUB_PATH = import.meta.env.VITE_GITHUB_PATH || 'public/videos';

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
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_PATH}/${fileName}`;
}

export function getPublicVideoUrl(fileName: string): string {
  return getRawUrl(fileName);
}

async function getFileSha(path: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
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
  try {
    const response = await fetch(
      `${API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message,
          content,
          branch: GITHUB_BRANCH,
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
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return {
      success: false,
      error: 'GitHub 配置不完整，请检查环境变量'
    };
  }

  const fileName = generateFileName(file.name);
  const path = `${GITHUB_PATH}/${fileName}`;
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
  if (!GITHUB_TOKEN) return false;

  try {
    const playlistPath = `${GITHUB_PATH}/playlist.json`;
    const sha = await getFileSha(playlistPath);
    
    let playlist: PlaylistData = { videos: [] };
    
    if (sha) {
      const response = await fetch(
        `${API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${playlistPath}`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
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

export async function loadPlaylistFromGitHub(): Promise<Video[]> {
  try {
    const rawUrl = getRawUrl('playlist.json') + `?t=${Date.now()}`;
    const response = await fetch(rawUrl);
    if (!response.ok) return [];
    
    const data: PlaylistData = await response.json();
    return data.videos.map(v => ({
      ...v,
      fileDataUrl: getRawUrl(v.fileName),
      thumbnail: v.thumbnail ? getRawUrl(v.thumbnail) : '',
      sentences: v.sentences,
    }));
  } catch (e) {
    console.warn('加载 playlist 失败', e);
    return [];
  }
}
