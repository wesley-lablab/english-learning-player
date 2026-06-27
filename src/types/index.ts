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
