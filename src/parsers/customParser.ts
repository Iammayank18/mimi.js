import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

export const customParser: RequestHandler = (
  req: MimiRequest,
  _res: MimiResponse,
  next: NextFunction,
): void => {
  if (req.headers['content-type'] === 'application/custom') {
    req.body = {};
  }
  next();
};
