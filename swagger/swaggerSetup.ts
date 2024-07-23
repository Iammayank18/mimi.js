import { Express } from 'express';
import expressJSDocSwagger, { Options, InfoObject, Security, Servers } from 'express-jsdoc-swagger';

// Define an interface for the setup options
export interface SetupOptions {
  info?: InfoObject;
  baseDir: string;
  filesPattern: string | string[];
  security?: Security;
  servers?: string[] | Servers[];
  exposeSwaggerUI?: boolean;
  swaggerUIPath?: string;
  exposeApiDocs?: boolean;
  apiDocsPath?: string;
  swaggerUiOptions?: object;
  notRequiredAsNullable?: boolean;
}

// Define the setupSwagger function
const setupSwagger = (app: Express, options: SetupOptions): void => {
  const mainOptions: Options = {
    info: {
      version: options?.info?.version || '',
      title: options?.info?.title || '',
      license: {
        name: options?.info?.license?.name || '',
        url: options?.info?.license?.url || '',
      },
      description: options?.info?.description || '',
      contact: {
        name: options?.info?.contact?.name || '',
        url: options?.info?.contact?.url || '',
        email: options?.info?.contact?.email || '',
      },
      termsOfService: options?.info?.termsOfService || '',
    },
    security: {
      BasicAuth: {
        type: 'http',
        scheme: 'basic',
      },
    },
    baseDir: './',
    filesPattern: './**/*.js',
    swaggerUIPath: '/api-docs',
    exposeSwaggerUI: true,
    exposeApiDocs: false,
    apiDocsPath: '/v3/api-docs',
    notRequiredAsNullable: false,
    swaggerUiOptions: {},
  };

  const mergedOptions: Options = { ...mainOptions, ...options };

  expressJSDocSwagger(app)(mergedOptions);
};

export default setupSwagger;
