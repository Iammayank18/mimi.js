require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { jsonParser, urlencodedParser, customParser } = require('./parsers');
const setupSwagger = require('./swagger');
const { authMiddleware } = require('./auth');
const loadRoutes = require('./router');
const { comparePassword, generateToken, verifyToken, hashPassword } = require('./auth');
const { requestLogger } = require('./logger');
const SQLiteManager = require('./db/sqllite');
const mongodbManager = require('./db/mongodb');
function mimi() {
  const app = express();
  const publicPath = path.join(process.cwd(), 'public');
  app.use(express.static(publicPath));
  app.use(helmet());
  app.use(cors());
  app.use(requestLogger);
  app.use(jsonParser);
  app.use(urlencodedParser);
  app.use(customParser);

  loadRoutes(app);

  return app;
}

module.exports = mimi;

module.exports.setupSwagger = setupSwagger;
module.exports.customParser = customParser;
module.exports.hashPassword = hashPassword;
module.exports.comparePassword = comparePassword;
module.exports.generateToken = generateToken;
module.exports.verifyToken = verifyToken;
module.exports.authMiddleware = authMiddleware;
module.exports.Router = express.Router;
module.exports.mongodbManager = mongodbManager;
module.exports.SQLiteManager = SQLiteManager;
