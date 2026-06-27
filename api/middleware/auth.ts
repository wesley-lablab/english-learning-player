import { type Request, type Response, type NextFunction } from 'express';

const ADMIN_TOKEN = 'parent_admin_token';

declare global {
  namespace Express {
    interface Request {
      isAdmin?: boolean;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (token === ADMIN_TOKEN) {
    req.isAdmin = true;
    next();
  } else {
    res.status(401).json({ success: false, error: '未授权访问' });
  }
}

export function generateToken(): string {
  return ADMIN_TOKEN;
}
