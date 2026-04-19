import mongoose, { Schema, Model, SchemaDefinition } from 'mongoose';

export class mongodbManager {
  private static instance: mongodbManager | null = null;
  private databasePath!: string;
  private connection: Promise<void> | null = null;

  constructor(databasePath: string) {
    if (mongodbManager.instance) {
      return mongodbManager.instance;
    }
    this.databasePath = databasePath;
    mongodbManager.instance = this;
  }

  connect(): Promise<string> {
    if (this.connection) {
      return this.connection.then(() => 'Your mongodb database is already connected');
    }

    this.connection = mongoose
      .connect(this.databasePath)
      .then(() => undefined);

    return this.connection.then(() => 'Your mongodb database connected successfully');
  }

  createCollection<T = Record<string, unknown>>(
    collectionName: string,
    schemaDefinition: SchemaDefinition,
  ): Model<T> {
    const schema = new Schema(schemaDefinition, { timestamps: true });
    return mongoose.model<T>(collectionName, schema);
  }
}
