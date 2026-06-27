import type { Video } from '../types';

const videoUrl = (fileName: string) => `${import.meta.env.BASE_URL}videos/${fileName}`;

/**
 * Static videos that are committed to GitHub under public/videos.
 *
 * Quick usage:
 * 1. Put mp4 files in public/videos.
 * 2. Make sure the fileName below matches the real file name exactly.
 * 3. The app will use fileDataUrl to play the same GitHub-hosted file on every device.
 */
export const STATIC_VIDEOS: Video[] = [
  {
    id: 1001,
    title: '第一单元：字母学习',
    description: '跟着视频学习26个英文字母的正确发音',
    category: 'course',
    duration: 180,
    fileName: 'sample1.mp4',
    thumbnail: '',
    createdAt: '2026-06-27T00:00:00.000Z',
    fileDataUrl: videoUrl('sample1.mp4'),
    fileType: 'video/mp4',
  },
  {
    id: 1002,
    title: '第二单元：日常对话',
    description: '学习早上打招呼、自我介绍等日常用语',
    category: 'course',
    duration: 240,
    fileName: 'sample2.mp4',
    thumbnail: '',
    createdAt: '2026-06-27T00:00:00.000Z',
    fileDataUrl: videoUrl('sample2.mp4'),
    fileType: 'video/mp4',
  },
  {
    id: 1003,
    title: '拓展：英语儿歌欣赏',
    description: '好听的英语儿歌，培养英语语感',
    category: 'extension',
    duration: 200,
    fileName: 'sample3.mp4',
    thumbnail: '',
    createdAt: '2026-06-27T00:00:00.000Z',
    fileDataUrl: videoUrl('sample3.mp4'),
    fileType: 'video/mp4',
  },
];
