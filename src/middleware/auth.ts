import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

export type AuthUser = {
  userId: number;
  employeeId: number;
  username: string;
  roles: string[];
  branchId: number | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const token = auth.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET belum diisi');
    req.user = jwt.verify(token, secret) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ message: 'Token tidak valid' });
  }
}

export function allowRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles ?? [];
    if (!roles.some((role) => userRoles.includes(role))) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }
    next();
  };
}
