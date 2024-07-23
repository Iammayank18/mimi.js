const express = require('express');
const path = require('path');
const fs = require('fs');
const { jsonParser, urlencodedParser } = require('../parsers/bodyParser');
const customParser = require('../parsers/customParser');
const setupSwagger = require('../swagger/swaggerSetup');
const authMiddleware = require('../auth/authMiddleware');
const loadRoutes = require('./router');
const { comparePassword, generateToken, verifyToken, hashPassword } = require('../auth/authHelper');
const { requestLogger, logger } = require('../logger/logger');

function createApplication(routesDir = 'routes') {
  const app = express();

  app.use(requestLogger);
  app.use(jsonParser);
  app.use(urlencodedParser);
  app.use(customParser);

  loadRoutes(app);

  return app;
}

module.exports = createApplication;

module.exports.setupSwagger = setupSwagger;
module.exports.customParser = customParser;
module.exports.hashPassword = hashPassword;
module.exports.comparePassword = comparePassword;
module.exports.generateToken = generateToken;
module.exports.verifyToken = verifyToken;
module.exports.authMiddleware = authMiddleware;
module.exports.Router = express.Router;
