"use strict";
const express = require("express");
const { jsonParser, urlencodedParser } = require("../parsers/bodyParser.js");
const customParser = require("../parsers/customParser.js");
const setupSwagger = require("../swagger/swaggerSetup.js");
var Route = require("./routes.js");
var Router = require("./router.js");

exports = module.exports = mimi;

function mimi() {
  const app = express();

  // Middleware
  app.use(jsonParser);
  app.use(urlencodedParser);
  app.use(customParser);

  return app;
}

exports.Router = Router;
exports.Route = Route;
exports.setupSwagger = setupSwagger;
