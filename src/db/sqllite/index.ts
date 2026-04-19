import { Sequelize, ModelAttributes, Model, ModelStatic } from 'sequelize';
import { logger } from '../../middleware/logger';

export class SQLiteManager {
  private static instance: SQLiteManager | null = null;
  private databasePath!: string;
  sequelize!: Sequelize;

  constructor(databasePath: string) {
    if (SQLiteManager.instance) {
      return SQLiteManager.instance;
    }

    this.databasePath = databasePath;
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: this.databasePath,
      logging: (msg: string) => logger.info(msg),
    });

    SQLiteManager.instance = this;
  }

  async connect(): Promise<string> {
    await this.sequelize.authenticate();
    return 'database connected';
  }

  createModel<T extends Model>(
    modelName: string,
    schemaDefinition: ModelAttributes,
  ): ModelStatic<T> {
    return this.sequelize.define(modelName, schemaDefinition) as ModelStatic<T>;
  }
}
