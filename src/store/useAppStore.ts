import { create } from 'zustand';
import type { PlaybackRate, Video, Settings } from '../types';

interface AppState {
  isAdmin: boolean;
  settings: Settings;
  currentVideo: Video | null;
  playbackRate: PlaybackRate;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  selectedCategory: string;
  
  setIsAdmin: (isAdmin: boolean) => void;
  setSettings: (settings: Settings) => void;
  setCurrentVideo: (video: Video | null) => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setSelectedCategory: (category: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAdmin: false,
  settings: {
    childName: '小朋友',
    childAvatar: '🧒',
  },
  currentVideo: null,
  playbackRate: 1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  selectedCategory: 'all',

  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setSettings: (settings) => set({ settings }),
  setCurrentVideo: (video) => set({ currentVideo: video }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
}));
