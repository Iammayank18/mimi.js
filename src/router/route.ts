import { Layer } from './layer';
import { registry } from '../schema/registry';
import { createValidator } from '../schema/validator';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler, RouteSchema } from '../types';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all'] as const;

export class Route {
  path: string;
  stack: Layer[] = [];
  methods: Record<string, boolean> = {};

  constructor(path: string) {
    this.path = path;
    this.dispatch = this.dispatch.bind(this);
  }

  _handles_method(method: string): boolean {
    if (this.methods['all']) return true;
    return Boolean(this.methods[method.toLowerCase()]);
  }

  dispatch(req: MimiRequest, res: MimiResponse, done: NextFunction): void {
    let idx = 0;
    const stack = this.stack;
    const method = req.method?.toLowerCase() ?? 'get';

    function next(err?: Error | string): void {
      if (err && err === 'route') {
        return done();
      }
      if (err && err === 'router') {
        return done(err as string);
      }

      const layer = stack[idx++];
      if (!layer) return done(err as Error | undefined);

      if (layer.method && layer.method !== method && method !== 'head') {
        return next(err);
      }

      if (err) {
        layer.handleError(err as Error, req, res, next);
      } else {
        layer.handleRequest(req, res, next);
      }
    }

    next();
  }
}

// Dynamically add HTTP method shortcuts to Route.prototype
HTTP_METHODS.forEach((method) => {
  (Route.prototype as any)[method] = function (
    schemaOrHandler: RouteSchema | RequestHandler | undefined,
    ...rest: RequestHandler[]
  ) {
    let schema: RouteSchema | undefined;
    let handlers: RequestHandler[];

    if (schemaOrHandler === undefined || schemaOrHandler === null) {
      schema = undefined;
      handlers = rest;
    } else if (typeof schemaOrHandler === 'function') {
      schema = undefined;
      handlers = [schemaOrHandler, ...rest];
    } else {
      schema = schemaOrHandler as RouteSchema;
      handlers = rest;
    }

    if (schema) {
      registry.register(method === 'all' ? 'ALL' : method.toUpperCase(), this.path, schema);
      const validatorLayer = new Layer('/', {}, createValidator(schema) as any);
      if (method !== 'all') validatorLayer.method = method;
      this.stack.push(validatorLayer);
    }

    handlers.forEach((handler) => {
      const layer = new Layer('/', {}, handler);
      if (method !== 'all') {
        layer.method = method;
        this.methods[method] = true;
      } else {
        this.methods['all'] = true;
      }
      this.stack.push(layer);
    });

    return this;
  };
});
