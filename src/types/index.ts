// 课程 - 包含多个视频
export interface Course {
  id: number;
  title: string;
  description: string;
  icon: string;
  videoIds: number[];
  audioFileName?: string;
  createdAt: string;
}

// 视频
export interface Video {
  id: number;
  title: string;
  description: string;
  category: string;
  duration: number;
  fileName: string;
  thumbnail: string;
  createdAt: string;
  fileDataUrl?: string;
  fileType?: string;
  courseId?: number;
  audioFileName?: string;
  isPreset?: boolean;
  sentences?: Sentence[];
}

// 播放列表数据
export interface PlaylistData {
  courses: Course[];
  videos: Video[];
}

// 播放模式
export type PlayMode = 'single' | 'loop-one' | 'loop-all';
export type LoopMode = 'none' | 'single' | 'all';

// 组合播放状态
export interface PlaylistState {
  videos: Video[];
  currentIndex: number;
  playMode: LoopMode;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface StudyRecord {
  id: number;
  videoId: number;
  videoTitle: string;
  childName: string;
  watchedDuration: number;
  playbackRate: number;
  watchedAt: string;
}

export interface Settings {
  childName: string;
  childAvatar: string;
}

export interface StudyStats {
  totalVideos: number;
  totalDuration: number;
  recordsCount: number;
}

export type PlaybackRate = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

export const PLAYBACK_RATES: PlaybackRate[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface Sentence {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  translation?: string;
}
