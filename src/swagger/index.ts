import path from 'path';
import { registry } from '../schema/registry';
import { toOpenApiSchema, mimiPathToOpenApiPath, STATUS_TEXTS } from '../schema/zod-to-openapi';
import { serveStatic } from '../middleware';
import type { MimiApp, ZodSchema, SwaggerOptions } from '../types';

export type { SwaggerOptions } from '../types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSwaggerDistPath(): string {
  try {
    return path.dirname(require.resolve('swagger-ui-dist/package.json'));
  } catch {
    throw new Error(
      '[mimi] swagger-ui-dist is not installed. Run: npm install swagger-ui-dist',
    );
  }
}

function buildSpec(options: SwaggerOptions): Record<string, unknown> {
  const records = registry.getAll();
  const paths: Record<string, Record<string, unknown>> = {};

  for (const record of records) {
    const openApiPath = mimiPathToOpenApiPath(record.path);
    const method = record.method.toLowerCase();
    const schema = record.schema;

    if (!paths[openApiPath]) paths[openApiPath] = {};

    const operation: Record<string, unknown> = {};

    if (schema.summary) operation.summary = schema.summary;
    if (schema.description) operation.description = schema.description;
    if (schema.tags) operation.tags = schema.tags;
    if (schema.deprecated) operation.deprecated = schema.deprecated;
    if (schema.security) operation.security = schema.security;

    const parameters: unknown[] = [];

    if (schema.params) {
      const paramsJson = toOpenApiSchema(schema.params) as Record<string, unknown>;
      const props = (paramsJson.properties ?? {}) as Record<string, unknown>;
      for (const [name, propSchema] of Object.entries(props)) {
        parameters.push({ name, in: 'path', required: true, schema: propSchema });
      }
    }

    if (schema.query) {
      const queryJson = toOpenApiSchema(schema.query) as Record<string, unknown>;
      const props = (queryJson.properties ?? {}) as Record<string, unknown>;
      const required = (queryJson.required ?? []) as string[];
      for (const [name, propSchema] of Object.entries(props)) {
        parameters.push({ name, in: 'query', required: required.includes(name), schema: propSchema });
      }
    }

    if (schema.headers) {
      const headersJson = toOpenApiSchema(schema.headers) as Record<string, unknown>;
      const props = (headersJson.properties ?? {}) as Record<string, unknown>;
      const required = (headersJson.required ?? []) as string[];
      for (const [name, propSchema] of Object.entries(props)) {
        parameters.push({ name, in: 'header', required: required.includes(name), schema: propSchema });
      }
    }

    if (parameters.length > 0) operation.parameters = parameters;

    if (schema.body) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: toOpenApiSchema(schema.body) } },
      };
    }

    const responses: Record<string, unknown> = {};
    if (schema.response && Object.keys(schema.response).length > 0) {
      for (const [code, zodSchema] of Object.entries(schema.response)) {
        responses[code] = {
          description: STATUS_TEXTS[Number(code)] ?? code,
          content: { 'application/json': { schema: toOpenApiSchema(zodSchema as ZodSchema) } },
        };
      }
    } else {
      responses['200'] = { description: 'OK' };
    }
    operation.responses = responses;

    paths[openApiPath][method] = operation;
  }

  return {
    openapi: '3.0.0',
    info: options.info,
    ...(options.servers ? { servers: options.servers } : {}),
    ...(options.security ? { security: options.security } : {}),
    ...(options.components ? { components: options.components } : {}),
    paths,
  };
}

export function setupSwagger(app: MimiApp, options: SwaggerOptions): void {
  if ((app as any).__swaggerRegistered) return;
  (app as any).__swaggerRegistered = true;

  const distPath = getSwaggerDistPath();

  // Serve swagger-ui-dist assets from local package (no CDN, no CSP overrides needed)
  (app as any).use('/api-docs/_static', serveStatic(distPath));

  // Build spec lazily so all routes registered by loadRoutes() are included
  (app as any).get('/api-docs/swagger.json', (_req: unknown, res: any) => {
    res.json(buildSpec(options));
  });

  (app as any).get('/api-docs', (_req: unknown, res: any) => {
    const title = escapeHtml(options.info.title);
    res.set('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="/api-docs/_static/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api-docs/_static/swagger-ui-bundle.js"></script>
  <script src="/api-docs/_static/swagger-ui-standalone-preset.js"></script>
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
</html>`);
  });
}
