'use strict';
const mongoose = require('mongoose');

class mongodbManager {
  static instance = null;

  constructor(databasePath) {
    if (mongodbManager.instance) {
      return mongodbManager.instance;
    }

    this.databasePath = databasePath;
    this.connection = null;

    mongodbManager.instance = this;
  }

  connect() {
    if (this.connection) {
      return this.connection;
    }
    return new Promise((resolve, reject) => {
      this.connection = mongoose
        .connect(this.databasePath, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        })
        .then(() => {
          resolve('Your mongodb database connected successfully');
        })
        .catch((err) => {
          reject(`failed to connect mongodb database - ${err}`);
        });
    });
  }

  createCollection(collectionName, schemaDefinition) {
    const schema = new mongoose.Schema(schemaDefinition, {
      timestamps: true,
    });
    const model = mongoose.model(collectionName, schema);
    return model;
  }
}

module.exports = mongodbManager;
