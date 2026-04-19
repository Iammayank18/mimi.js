import type { MimiApp, Plugin } from '../types';

export function createRegister(app: MimiApp) {
  return function register(
    plugin: Plugin,
    options: Record<string, unknown> = {},
  ): MimiApp | Promise<MimiApp> {
    if (typeof plugin !== 'function') {
      throw new TypeError('plugin must be a function');
    }

    const result = plugin(app, options);

    if (result instanceof Promise) {
      return result.then(() => app);
    }

    return app;
  };
}
