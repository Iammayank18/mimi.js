'use strict';

const expressJSDocSwagger = require('express-jsdoc-swagger');
const { logger } = require('../logger/logger');

// Define the setupSwagger function
const setupSwagger = (app, options) => {
  try {
    const mainOptions = {
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
      filesPattern: options.filesPattern || './**/*.js',
      swaggerUIPath: '/api-docs',
      exposeSwaggerUI: true,
      exposeApiDocs: false,
      apiDocsPath: '/v3/api-docs',
      notRequiredAsNullable: false,
      swaggerUiOptions: {},
    };

    const mergedOptions = { ...mainOptions, ...options };
    expressJSDocSwagger(app)(mergedOptions);
  } catch (error) {
    logger.error(error);
  }
};

module.exports = setupSwagger;
