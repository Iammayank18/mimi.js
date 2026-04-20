import { describe, it, expect, vi } from 'vitest';

describe('logger', () => {
  it('exports a logger with info, warn, error methods', async () => {
    const { logger } = await import('../src/middleware/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('exports requestLogger as a function with length 3', async () => {
    const { requestLogger } = await import('../src/middleware/logger');
    expect(typeof requestLogger).toBe('function');
    expect(requestLogger.length).toBe(3);
  });

  it('requestLogger calls next() synchronously', async () => {
    const { requestLogger } = await import('../src/middleware/logger');
    const req: any = { method: 'GET', url: '/test', headers: {} };
    const res: any = { on: vi.fn(), statusCode: 200 };
    const next = vi.fn();
    requestLogger(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
