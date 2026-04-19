import swaggerJSDoc from 'swagger-jsdoc';
import type { MimiApp } from '../types';

export interface SwaggerLicense {
  name: string;
  url?: string;
}

export interface SwaggerContact {
  name?: string;
  url?: string;
  email?: string;
}

export interface SwaggerOptions {
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: SwaggerContact;
    license?: SwaggerLicense;
  };
  filesPattern?: string;
  servers?: Array<{ url: string; description?: string }>;
}

export function setupSwagger(app: MimiApp, options: SwaggerOptions): void {
  const spec = swaggerJSDoc({
    definition: {
      openapi: '3.0.0',
      info: options.info,
      servers: options.servers,
    },
    apis: [options.filesPattern ?? './**/*.js'],
  });

  (app as any).get('/api-docs/swagger.json', (_req: any, res: any) => {
    res.json(spec);
  });

  (app as any).get('/api-docs', (_req: any, res: any) => {
    const title = options.info.title ?? 'API Docs';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: '/api-docs/swagger.json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: 'StandaloneLayout',
      });
    };
  </script>
</body>
</html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  });
}
