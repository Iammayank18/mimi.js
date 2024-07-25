const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

async function loadRoutes(app) {
  try {
    const routesPath = path.join(process.cwd(), 'routes');
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(routesPath)) {
      console.error('Routes directory does not exist.');
      return;
    }

    let isModule = false;
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      isModule = packageJson.type === 'module';
    }

    const files = fs.readdirSync(routesPath);

    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(routesPath, file);

        if (isModule) {
          const routeModule = await import(filePath);
          app.use(routeModule.default);
        } else {
          const route = require(filePath);
          app.use(route);
        }
      }
    }
  } catch (error) {
    logger.error(error);
  }
}

module.exports = loadRoutes;
