const createApplication = require('./lib/mimi');
const setupSwagger = require('./lib/mimi').setupSwagger;
const customParser = require('./lib/mimi').customParser;
const hashPassword = require('./lib/mimi').hashPassword;
const comparePassword = require('./lib/mimi').comparePassword;
const generateToken = require('./lib/mimi').generateToken;
const verifyToken = require('./lib/mimi').verifyToken;
const authMiddleware = require('./lib/mimi').authMiddleware;
const Router = require('./lib/mimi').Router;

module.exports = {
  mimi: createApplication,
  setupSwagger,
  customParser,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
  Router,
};
