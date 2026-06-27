import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface Video {
  id: number;
  title: string;
  description: string;
  category: string;
  duration: number;
  fileName: string;
  thumbnail: string;
  createdAt: string;
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
  parentPassword: string;
  childName: string;
  childAvatar: string;
}

interface Database {
  videos: Video[];
  categories: Category[];
  studyRecords: StudyRecord[];
  settings: Settings;
  nextVideoId: number;
  nextRecordId: number;
}

const defaultCategories: Category[] = [
  { id: 'all', name: '全部', icon: '🌟', color: '#FF9F43', sortOrder: 0 },
  { id: 'course', name: '课程', icon: '📘', color: '#54A0FF', sortOrder: 1 },
  { id: 'extension', name: '课程拓展', icon: '🚀', color: '#FF6B6B', sortOrder: 2 },
];

const defaultSettings: Settings = {
  parentPassword: bcrypt.hashSync('123456', 10),
  childName: '小朋友',
  childAvatar: '🧒',
};

function initDB(): Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDB: Database = {
      videos: [
        {
          id: 1,
          title: '第一单元：字母学习',
          description: '跟着视频学习26个英文字母的正确发音',
          category: 'course',
          duration: 180,
          fileName: 'sample1.mp4',
          thumbnail: '',
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          title: '第二单元：日常对话',
          description: '学习早上打招呼、自我介绍等日常用语',
          category: 'course',
          duration: 240,
          fileName: 'sample2.mp4',
          thumbnail: '',
          createdAt: new Date().toISOString(),
        },
        {
          id: 3,
          title: '拓展：英语儿歌欣赏',
          description: '好听的英语儿歌，培养英语语感',
          category: 'extension',
          duration: 200,
          fileName: 'sample3.mp4',
          thumbnail: '',
          createdAt: new Date().toISOString(),
        },
      ],
      categories: defaultCategories,
      studyRecords: [],
      settings: defaultSettings,
      nextVideoId: 4,
      nextRecordId: 1,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }

  const data = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveDB(db: Database): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db: Database = initDB();

export function getVideos(category?: string): Video[] {
  if (!category || category === 'all') {
    return [...db.videos].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  return db.videos
    .filter(v => v.category === category)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getVideoById(id: number): Video | undefined {
  return db.videos.find(v => v.id === id);
}

export function addVideo(video: Omit<Video, 'id' | 'createdAt'>): Video {
  const newVideo: Video = {
    ...video,
    id: db.nextVideoId,
    createdAt: new Date().toISOString(),
  };
  db.videos.push(newVideo);
  db.nextVideoId++;
  saveDB(db);
  return newVideo;
}

export function updateVideo(id: number, updates: Partial<Video>): Video | undefined {
  const index = db.videos.findIndex(v => v.id === id);
  if (index === -1) return undefined;
  db.videos[index] = { ...db.videos[index], ...updates };
  saveDB(db);
  return db.videos[index];
}

export function deleteVideo(id: number): boolean {
  const index = db.videos.findIndex(v => v.id === id);
  if (index === -1) return false;
  const video = db.videos[index];
  const filePath = path.join(__dirname, '..', 'uploads', video.fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  db.videos.splice(index, 1);
  saveDB(db);
  return true;
}

export function getCategories(): Category[] {
  return [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getSettings(): Settings {
  return { ...db.settings };
}

export function verifyPassword(password: string): boolean {
  return bcrypt.compareSync(password, db.settings.parentPassword);
}

export function changePassword(newPassword: string): void {
  db.settings.parentPassword = bcrypt.hashSync(newPassword, 10);
  saveDB(db);
}

export function updateChildProfile(name: string, avatar: string): void {
  db.settings.childName = name;
  db.settings.childAvatar = avatar;
  saveDB(db);
}

export function addStudyRecord(record: Omit<StudyRecord, 'id' | 'watchedAt'>): StudyRecord {
  const newRecord: StudyRecord = {
    ...record,
    id: db.nextRecordId,
    watchedAt: new Date().toISOString(),
  };
  db.studyRecords.push(newRecord);
  db.nextRecordId++;
  saveDB(db);
  return newRecord;
}

export function getStudyRecords(limit: number = 20): StudyRecord[] {
  return [...db.studyRecords]
    .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
    .slice(0, limit);
}

export function getStudyStats(): { totalVideos: number; totalDuration: number; recordsCount: number } {
  const totalDuration = db.studyRecords.reduce((sum, r) => sum + r.watchedDuration, 0);
  return {
    totalVideos: db.videos.length,
    totalDuration,
    recordsCount: db.studyRecords.length,
  };
}
