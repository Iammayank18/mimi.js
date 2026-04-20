type MongooseModule = typeof import('mongoose');

function getMongoose(): MongooseModule {
  try {
    return require('mongoose') as MongooseModule;
  } catch {
    throw new Error('[mimijs] mongoose is not installed. Run: npm install mongoose');
  }
}

class MongodbManager {
  private _connected = false;

  async connect(uri: string, options: Record<string, unknown> = {}): Promise<string> {
    if (this._connected) return 'Your mongodb database is already connected';
    const mongoose = getMongoose();
    await mongoose.connect(uri, options as any);
    this._connected = true;
    return 'Your mongodb database connected successfully';
  }

  createCollection(collectionName: string, schemaDefinition: Record<string, unknown>): unknown {
    const mongoose = getMongoose();
    const { Schema } = mongoose;
    const schema = new Schema(schemaDefinition as any, { timestamps: true });
    return mongoose.model<any>(collectionName, schema);
  }
}

export const mongodbManager = new MongodbManager();
