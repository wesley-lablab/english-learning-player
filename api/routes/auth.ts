import express, { type Request, type Response } from 'express';
import { verifyPassword, getSettings, updateChildProfile, changePassword } from '../data/store.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', (req: Request, res: Response): void => {
  const { password } = req.body;
  
  if (!password) {
    res.status(400).json({ success: false, error: '请输入密码' });
    return;
  }

  if (verifyPassword(password)) {
    const token = generateToken();
    res.json({ 
      success: true, 
      data: { token },
      message: '登录成功'
    });
  } else {
    res.status(401).json({ success: false, error: '密码错误' });
  }
});

router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ success: true, message: '登出成功' });
});

router.get('/status', (req: Request, res: Response): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const isLoggedIn = token === generateToken();
  res.json({ success: true, data: { isLoggedIn } });
});

router.get('/settings', (_req: Request, res: Response): void => {
  const settings = getSettings();
  const { parentPassword, ...publicSettings } = settings;
  res.json({ success: true, data: publicSettings });
});

router.put('/settings/child', requireAuth, (req: Request, res: Response): void => {
  const { childName, childAvatar } = req.body;
  updateChildProfile(childName, childAvatar);
  res.json({ success: true, message: '更新成功' });
});

router.put('/settings/password', requireAuth, (req: Request, res: Response): void => {
  const { oldPassword, newPassword } = req.body;
  
  if (!verifyPassword(oldPassword)) {
    res.status(400).json({ success: false, error: '原密码错误' });
    return;
  }
  
  changePassword(newPassword);
  res.json({ success: true, message: '密码修改成功' });
});

export default router;
