
const expressJSDocSwagger = require("express-jsdoc-swagger");

const setupSwagger = (app, options) => {
  const mainOptions = {
    info: {
      version: "1.0.0",
      title: "Albums store",
      license: {
        name: "MIT",
      },
    },
    security: {
      BasicAuth: {
        type: "http",
        scheme: "basic",
      },
    },
    // Base directory which we use to locate your JSDOC files
    baseDir: './',
    // Glob pattern to find your jsdoc files (multiple patterns can be added in an array)
    filesPattern: options?.filesPattern || "./**/*.js",
    // URL where SwaggerUI will be rendered
    swaggerUIPath: "/api-docs",
    // Expose OpenAPI UI
    exposeSwaggerUI: true,
    // Expose Open API JSON Docs documentation in `apiDocsPath` path.
    exposeApiDocs: false,
    // Open API JSON Docs endpoint.
    apiDocsPath: "/v3/api-docs",
    // Set non-required fields as nullable by default
    notRequiredAsNullable: false,
    // You can customize your UI options.
    // you can extend swagger-ui-express config. You can checkout an example of this
    // in the `example/configuration/swaggerOptions.js`
    swaggerUiOptions: {},
    // multiple option in case you want more that one instance
    multiple: true,
  };
  console.log(mainOptions);
  expressJSDocSwagger(app)(mainOptions);
};

module.exports = setupSwagger;
