'use strict';

const { Sequelize, DataTypes } = require('sequelize');
const { logger } = require('../../logger');

class SQLiteManager {
  static instance = null;

  constructor(databasePath) {
    if (SQLiteManager.instance) {
      return SQLiteManager.instance;
    }

    this.databasePath = databasePath;
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: this.databasePath,
      logging: (msg) => logger.info(msg),
    });

    SQLiteManager.instance = this;

    return SQLiteManager.instance;
  }

  connect() {
    return new Promise((ressolve, reject) => {
      const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: this.databasePath,
        logging: (msg) => logger.info(msg),
      });
      sequelize
        .authenticate()
        .then(() => {
          ressolve('database connected');
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  createModel(modelName, schemaDefinition) {
    const model = this.sequelize.define(modelName, schemaDefinition);

    return model;
  }
}

module.exports = SQLiteManager;
