import { logger } from '../../middleware/logger';

type SequelizeModule = typeof import('sequelize');

function getSequelize(): SequelizeModule {
  try {
    return require('sequelize') as SequelizeModule;
  } catch {
    throw new Error(
      '[mimijs] sequelize and sqlite3 are not installed. Run: npm install sequelize sqlite3',
    );
  }
}

export class SQLiteManager {
  private static instance: SQLiteManager | null = null;
  sequelize!: import('sequelize').Sequelize;

  constructor(databasePath = ':memory:') {
    if (SQLiteManager.instance) {
      return SQLiteManager.instance;
    }
    const { Sequelize } = getSequelize();
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: databasePath,
      logging: (msg: string) => logger.info(msg),
    });
    SQLiteManager.instance = this;
  }

  async connect(): Promise<string> {
    await this.sequelize.authenticate();
    return 'database connected';
  }

  createModel(
    modelName: string,
    schemaDefinition: import('sequelize').ModelAttributes,
  ): import('sequelize').ModelStatic<import('sequelize').Model> {
    return this.sequelize.define(modelName, schemaDefinition);
  }
}
