import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  getVideos,
  getVideoById,
  addVideo,
  updateVideo,
  deleteVideo,
  getCategories,
} from '../data/store.js';
import { requireAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /mp4|webm|mov|avi|mkv|jpg|jpeg|png|gif|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error('只支持视频和图片文件上传'));
    }
  },
});

router.get('/videos', (req: Request, res: Response): void => {
  const category = req.query.category as string | undefined;
  const videos = getVideos(category);
  res.json({ success: true, data: videos });
});

router.get('/videos/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const video = getVideoById(id);
  if (!video) {
    res.status(404).json({ success: false, error: '视频不存在' });
    return;
  }
  res.json({ success: true, data: video });
});

router.get('/categories', (_req: Request, res: Response): void => {
  const categories = getCategories();
  res.json({ success: true, data: categories });
});

router.post('/videos', requireAuth, upload.single('video'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传视频文件' });
      return;
    }

    const { title, description, category, duration } = req.body;

    if (!title || !category) {
      res.status(400).json({ success: false, error: '标题和分类不能为空' });
      return;
    }

    const video = addVideo({
      title,
      description: description || '',
      category,
      duration: parseInt(duration, 10) || 0,
      fileName: req.file.filename,
      thumbnail: '',
    });

    res.status(201).json({ success: true, data: video });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: '上传失败' });
  }
});

router.put('/videos/:id', requireAuth, (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const { title, description, category } = req.body;
  const video = updateVideo(id, { title, description, category });
  if (!video) {
    res.status(404).json({ success: false, error: '视频不存在' });
    return;
  }
  res.json({ success: true, data: video });
});

router.delete('/videos/:id', requireAuth, (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const deleted = deleteVideo(id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '视频不存在' });
    return;
  }
  res.json({ success: true, message: '删除成功' });
});

router.get('/uploads/:filename', (req: Request, res: Response): void => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOAD_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: '文件不存在' });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

export default router;
