import type { RouteSchema } from '../types';

export interface RouteRecord {
  method: string;
  path: string;
  schema: RouteSchema;
}

class SchemaRegistry {
  private records: RouteRecord[] = [];

  register(method: string, path: string, schema: RouteSchema): void {
    this.records.push({ method, path, schema });
  }

  getAll(): readonly RouteRecord[] {
    return this.records;
  }

  clear(): void {
    this.records = [];
  }
}

export const registry = new SchemaRegistry();
