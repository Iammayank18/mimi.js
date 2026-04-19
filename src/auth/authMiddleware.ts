import { verifyToken } from './authHelper';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

export const authMiddleware: RequestHandler = (
  req: MimiRequest,
  res: MimiResponse,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  (req as any).user = decoded;
  next();
};
