import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '../dist');

// ESM wrapper — gives ESM consumers a proper default export (mimi function)
// and re-exports all named exports from the CJS build.
const mjs = `import cjs from './index.js';

const {
  mimi,
  setupSwagger,
  json,
  urlencoded,
  cors,
  security,
  serveStatic,
  requestLogger,
  customParser,
  logger,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
  Router,
  loadRoutes,
  mongodbManager,
  SQLiteManager,
} = cjs;

export {
  mimi,
  setupSwagger,
  json,
  urlencoded,
  cors,
  security,
  serveStatic,
  requestLogger,
  customParser,
  logger,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
  Router,
  loadRoutes,
  mongodbManager,
  SQLiteManager,
};

export default mimi;
`;

// Type declaration for the ESM entry point — mirrors index.d.ts
const dmts = `export * from './index.js';
export { mimi as default } from './index.js';
`;

writeFileSync(resolve(dist, 'index.mjs'), mjs);
writeFileSync(resolve(dist, 'index.d.mts'), dmts);

console.log('ESM wrapper written: dist/index.mjs + dist/index.d.mts');
