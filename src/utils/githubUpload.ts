import type { Video, Course, Sentence, PlaylistData } from '../types';

const GITHUB_SETTINGS_KEY = 'elp_github_settings';
const CONFIG_FILE = '.github-config.json';

interface GitHubSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

interface RemoteConfig {
  githubToken: string;
  owner: string;
  repo: string;
  lastUpdated: string;
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

// 缓存远程配置，避免重复请求
let cachedRemoteConfig: RemoteConfig | null = null;

// 从 GitHub 配置文件加载设置
async function loadRemoteConfig(): Promise<RemoteConfig | null> {
  if (cachedRemoteConfig) return cachedRemoteConfig;
  
  try {
    const url = `https://raw.githubusercontent.com/${DEFAULT_SETTINGS.owner}/${DEFAULT_SETTINGS.repo}/${DEPLOY_BRANCH}/${DEPLOY_PATH}/${CONFIG_FILE}?t=${Date.now()}`;
    const response = await fetch(url);
    if (response.ok) {
      cachedRemoteConfig = await response.json();
      return cachedRemoteConfig;
    }
  } catch (e) {
    console.warn('加载远程配置失败', e);
  }
  return null;
}

// 保存设置到 GitHub 配置文件
export async function saveSettingsToGitHub(settings: Partial<GitHubSettings>): Promise<boolean> {
  const token = DEFAULT_SETTINGS.token; // 使用已配置的 token
  if (!token) return false;
  
  try {
    const configPath = `${DEFAULT_SETTINGS.path}/${CONFIG_FILE}`;
    
    // 获取当前 SHA
    const shaRes = await fetch(
      `https://api.github.com/repos/${DEFAULT_SETTINGS.owner}/${DEFAULT_SETTINGS.repo}/contents/${configPath}?ref=${DEPLOY_BRANCH}`,
      {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
      }
    );
    
    let sha: string | undefined;
    if (shaRes.ok) {
      const data = await shaRes.json();
      sha = data.sha;
    }
    
    // 构建新配置
    const remoteConfig: RemoteConfig = {
      githubToken: settings.token || DEFAULT_SETTINGS.token,
      owner: settings.owner || DEFAULT_SETTINGS.owner,
      repo: settings.repo || DEFAULT_SETTINGS.repo,
      lastUpdated: new Date().toISOString(),
    };
    
    const content = JSON.stringify(remoteConfig, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    
    // 写入 GitHub
    const putRes = await fetch(
      `https://api.github.com/repos/${DEFAULT_SETTINGS.owner}/${DEFAULT_SETTINGS.repo}/contents/${configPath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: 'Update GitHub config',
          content: base64Content,
          branch: DEPLOY_BRANCH,
          ...(sha ? { sha } : {})
        })
      }
    );
    
    return putRes.ok;
  } catch (e) {
    console.error('保存配置到 GitHub 失败', e);
    return false;
  }
}

// 清除缓存的配置（当 Token 改变时需要调用）
export function clearConfigCache(): void {
  cachedRemoteConfig = null;
}

function getGitHubSettings(): GitHubSettings {
  // 优先使用 URL 参数中的 token
  try {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const urlToken = urlParams.get('token');
    if (urlToken) {
      const settings = { ...DEFAULT_SETTINGS, token: urlToken };
      localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(settings));
      return settings;
    }
  } catch {}
  
  // 使用 localStorage
  try {
    const saved = localStorage.getItem(GITHUB_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

// 异步获取 Token，优先使用 localStorage，否则尝试从远程配置获取
export async function getGitHubTokenAsync(): Promise<string> {
  const localSettings = getGitHubSettings();
  if (localSettings.token) {
    return localSettings.token;
  }
  
  // 尝试从远程获取
  const remoteConfig = await loadRemoteConfig();
  if (remoteConfig?.githubToken) {
    // 保存到 localStorage 以便下次快速获取
    const settings = { ...DEFAULT_SETTINGS, token: remoteConfig.githubToken };
    localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(settings));
    return remoteConfig.githubToken;
  }
  
  return '';
}

export function saveGitHubSettings(settings: Partial<GitHubSettings>): void {
  try {
    const current = getGitHubSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(merged));
    
    // 异步保存到 GitHub（不阻塞主流程）
    saveSettingsToGitHub(settings).then(ok => {
      if (ok) {
        console.log('✅ 配置已同步到 GitHub');
      }
    });
  } catch (e) {
    console.error('保存设置失败', e);
  }
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
export async function removeVideoFromPlaylist(videoId: number): Promise<{ success: boolean; error?: string }> {
  const token = await getGitHubTokenAsync();
  if (!token) {
    return { success: false, error: 'GitHub Token 未配置' };
  }

  try {
    const playlistPath = `${getPath()}/playlist.json`;
    const sha = await getFileSha(playlistPath);
    
    if (!sha) {
      return { success: true };
    }
    
    const response = await fetch(
      `${API_BASE}/repos/${getOwner()}/${getRepo()}/contents/${playlistPath}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (!response.ok) {
      return { success: false, error: `HTTP Error: ${response.status}` };
    }
    
    const data = await response.json();
    const decoded = decodeURIComponent(escape(atob(data.content)));
    const playlist: PlaylistData = JSON.parse(decoded);
    
    playlist.videos = playlist.videos.filter(v => v.id !== videoId);
    
    playlist.courses = playlist.courses.map(c => ({
      ...c,
      videoIds: c.videoIds.filter(id => id !== videoId)
    })).filter(c => c.videoIds.length > 0);
    
    const jsonContent = JSON.stringify(playlist, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));
    
    const success = await putFile(
      playlistPath,
      base64Content,
      `Remove video from playlist: ${videoId}`,
      sha
    );
    
    return success ? { success: true } : { success: false, error: '上传到云端失败' };
  } catch (e) {
    console.error('从 playlist 删除视频失败:', e);
    return { success: false, error: e instanceof Error ? e.message : '删除失败' };
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
    const decoded = decodeURIComponent(escape(atob(data.content)));
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
