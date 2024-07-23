const fs = require('fs');
const path = require('path');
const { logger } = require('../logger/logger');

async function loadRoutes(app) {
  try {
    const routesPath = path.join(process.cwd(), 'routes');
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    // Check if routes directory exists
    if (!fs.existsSync(routesPath)) {
      console.error('Routes directory does not exist.');
      return;
    }

    // Check if package.json exists and contains "type": "module"
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
          // Use dynamic import for ES Modules
          const routeModule = await import(filePath);
          app.use(routeModule.default);
        } else {
          // Use require for CommonJS
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
