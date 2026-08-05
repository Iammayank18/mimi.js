import { writeFileSync } from 'fs';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '../dist');

// Derive the export list directly from the built CJS module so this script
// never gets out of sync when new exports are added.
const require = createRequire(import.meta.url);
const cjs = require(resolve(dist, 'index.js'));
const named = Object.keys(cjs).filter((k) => k !== 'default');

const destructure = named.join(',\n  ');
const exports_ = named.join(',\n  ');

// ESM wrapper — gives ESM consumers a proper default export (mimi function)
// and re-exports all named exports from the CJS build.
const mjs = `import cjs from './index.js';

const {
  ${destructure},
} = cjs;

export {
  ${exports_},
};

export default mimi;
`;

// Type declaration for the ESM entry point — mirrors index.d.ts
const dmts = `export * from './index.js';
export { mimi as default } from './index.js';
`;

writeFileSync(resolve(dist, 'index.mjs'), mjs);
writeFileSync(resolve(dist, 'index.d.mts'), dmts);

console.log(`ESM wrapper written: dist/index.mjs + dist/index.d.mts (${named.length} exports)`);
