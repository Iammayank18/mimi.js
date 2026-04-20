import { describe, it, expect } from 'vitest';
import { mongodbManager } from '../src/db/mongodb/index';
import { SQLiteManager } from '../src/db/sqllite/index';
import { hashPassword, comparePassword } from '../src/auth/authHelper';

describe('peer dependency lazy loading — positive path (deps present in devDeps)', () => {
  it('mongodbManager is a singleton instance with connect()', () => {
    expect(mongodbManager).toBeDefined();
    expect(typeof mongodbManager.connect).toBe('function');
  });

  it('SQLiteManager can be instantiated with in-memory SQLite', () => {
    const mgr = new SQLiteManager(':memory:');
    expect(mgr).toBeDefined();
    expect(typeof mgr.connect).toBe('function');
  });

  it('hashPassword produces a bcrypt hash', async () => {
    const hash = await hashPassword('test123');
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('comparePassword verifies the hash correctly', async () => {
    const hash = await hashPassword('secret');
    expect(await comparePassword('secret', hash)).toBe(true);
    expect(await comparePassword('wrong', hash)).toBe(false);
  });

  it('install-hint error messages are present in source', async () => {
    const fs = await import('fs');
    const mongoSrc = fs.readFileSync('src/db/mongodb/index.ts', 'utf8');
    const sqliteSrc = fs.readFileSync('src/db/sqllite/index.ts', 'utf8');
    const bcryptSrc = fs.readFileSync('src/auth/authHelper.ts', 'utf8');

    expect(mongoSrc).toContain('npm install mongoose');
    expect(sqliteSrc).toContain('npm install sequelize sqlite3');
    expect(bcryptSrc).toContain('npm install bcrypt');
  });
});
