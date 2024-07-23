import express, { Express, Router } from 'express';
import { jsonParser, urlencodedParser } from '../parsers/bodyParser';
import customParser from '../parsers/customParser';
import setupSwagger from '../swagger/swaggerSetup';
import authMiddleware from '../auth/authMiddleware';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../auth/authHelper';

// Define the `mimi` function
export function mimi(): Express {
  const app = express();

  // Middleware
  app.use(jsonParser);
  app.use(urlencodedParser);

  return app;
}

// Export additional modules
export {
  Router,
  setupSwagger,
  customParser,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
};
