import express, { type Request, type Response } from 'express';
import { addStudyRecord, getStudyRecords, getStudyStats } from '../data/store.js';

const router = express.Router();

router.get('/records', (_req: Request, res: Response): void => {
  const records = getStudyRecords(50);
  res.json({ success: true, data: records });
});

router.post('/records', (req: Request, res: Response): void => {
  const { videoId, videoTitle, childName, watchedDuration, playbackRate } = req.body;
  
  if (!videoId || !videoTitle) {
    res.status(400).json({ success: false, error: '视频信息不能为空' });
    return;
  }

  const record = addStudyRecord({
    videoId: parseInt(videoId, 10),
    videoTitle,
    childName: childName || '小朋友',
    watchedDuration: parseInt(watchedDuration, 10) || 0,
    playbackRate: parseFloat(playbackRate) || 1,
  });

  res.status(201).json({ success: true, data: record });
});

router.get('/stats', (_req: Request, res: Response): void => {
  const stats = getStudyStats();
  res.json({ success: true, data: stats });
});

export default router;
