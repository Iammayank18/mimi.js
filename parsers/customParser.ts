import { Request, Response, NextFunction } from 'express';

// Define the custom parser middleware
const customParser = (req: Request, res: Response, next: NextFunction): void => {
  if (req.headers['content-type'] === 'application/custom') {
    req.body = {}; // Parsed custom data
  }
  next();
};

export default customParser;
