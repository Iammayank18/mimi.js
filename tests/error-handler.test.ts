import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { mimi } from '../src/core/application';

async function request(
  server: http.Server,
  path: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.request(
      { hostname: '127.0.0.1', port: addr.port, path, method: 'GET' },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: raw }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('app.setErrorHandler()', () => {
  let server: http.Server;
  let app: ReturnType<typeof mimi>;

  beforeAll(async () => {
    app = mimi();

    app.get('/boom', (_req, _res, next) => {
      next(new Error('something broke'));
    });

    app.get('/http-error', (_req, _res, next) => {
      const err = Object.assign(new Error('not found'), { status: 404 });
      next(err);
    });

    app.setErrorHandler((err, _req, res) => {
      const status = (err as any).status ?? 500;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const body = JSON.stringify({ error: err.message, code: 'CUSTOM_HANDLER' });
      res.setHeader('Content-Length', Buffer.byteLength(body));
      res.end(body);
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve) as unknown as http.Server;
    });
  });

  afterAll(() => { server.close(); });

  it('custom handler receives the error and formats the response', async () => {
    const { status, body } = await request(server, '/boom');
    expect(status).toBe(500);
    const data = JSON.parse(body);
    expect(data.error).toBe('something broke');
    expect(data.code).toBe('CUSTOM_HANDLER');
  });

  it('custom handler receives error.status and can use it', async () => {
    const { status } = await request(server, '/http-error');
    expect(status).toBe(404);
  });

  it('routes without errors still return normally', async () => {
    app.get('/ok', (_req, res) => res.json({ ok: true }));
    const { status, body } = await request(server, '/ok');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ ok: true });
  });

  it('returns 404 for unknown routes (unaffected by error handler)', async () => {
    const { status } = await request(server, '/nonexistent');
    expect(status).toBe(404);
  });
});

describe('default error handler (no setErrorHandler called)', () => {
  let server: http.Server;

  beforeAll(async () => {
    const app = mimi();
    app.get('/fail', (_req, _res, next) => next(new Error('default error')));
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve) as unknown as http.Server;
    });
  });

  afterAll(() => { server.close(); });

  it('sends 500 JSON with the error message', async () => {
    const { status, body } = await request(server, '/fail');
    expect(status).toBe(500);
    const data = JSON.parse(body);
    expect(data.error).toBe('default error');
    expect(data.code).toBeUndefined();
  });
});
