import fs from 'fs';
import path from 'path';
import { logger } from './middleware/logger';
import type { MimiApp } from './types';

function isRouter(val: unknown): boolean {
  return val !== null && typeof val === 'object' && typeof (val as any).handle === 'function';
}

export default async function loadRoutes(app: MimiApp): Promise<void> {
  try {
    const routesPath = path.join(process.cwd(), 'routes');
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(routesPath)) return;

    let isModule = false;
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { type?: string };
      isModule = pkg.type === 'module';
    }

    const files = fs.readdirSync(routesPath);

    for (const file of files) {
      if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
      const filePath = path.join(routesPath, file);

      if (isModule) {
        const routeModule = (await import(filePath)) as { default?: unknown };
        const def = routeModule.default;
        if (typeof def === 'function' && !isRouter(def)) {
          (def as (app: MimiApp) => void)(app);
        } else if (isRouter(def)) {
          (app as any).use((def as any).handle.bind(def));
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const route = require(filePath) as unknown;
        const def = (route as any)?.default ?? route;
        if (isRouter(def)) {
          (app as any).use((def as any).handle.bind(def));
        } else if (typeof def === 'function') {
          (def as (app: MimiApp) => void)(app);
        }
      }
    }
  } catch (error) {
    logger.error(String(error));
  }
}
