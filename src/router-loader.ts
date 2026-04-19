import fs from 'fs';
import path from 'path';
import { logger } from './middleware/logger';
import type { MimiApp } from './types';

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
        const routeModule = await import(filePath) as { default?: (app: MimiApp) => void };
        if (typeof routeModule.default === 'function') {
          routeModule.default(app);
        } else {
          (app as any).use(routeModule.default);
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const route = require(filePath) as ((app: MimiApp) => void) | any;
        if (typeof route === 'function' && route.length > 0) {
          (app as any).use(route);
        }
      }
    }
  } catch (error) {
    logger.error(String(error));
  }
}
