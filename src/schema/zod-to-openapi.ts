import type { ZodSchema } from '../types';

export function toOpenApiSchema(schema: ZodSchema): Record<string, unknown> {
  try {
    const { $schema, ...clean } = schema.toJSONSchema();
    return clean;
  } catch {
    return {};
  }
}

export function mimiPathToOpenApiPath(path: string): string {
  return path.replace(/:([^/]+)/g, '{$1}');
}

export const STATUS_TEXTS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};
