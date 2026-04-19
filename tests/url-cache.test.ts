import { describe, it, expect } from 'vitest';
import http from 'http';
import net from 'net';
import '../src/core/request';

function makeReq(url: string): http.IncomingMessage {
  const req = new http.IncomingMessage(new net.Socket());
  req.url = url;
  return req;
}

describe('req.path and req.query — URL memoization', () => {
  it('req.path returns the pathname', () => {
    const req = makeReq('/users/42?page=2');
    expect((req as any).path).toBe('/users/42');
  });

  it('req.query returns query params as plain object', () => {
    const req = makeReq('/search?q=hello&limit=10');
    expect((req as any).query).toEqual({ q: 'hello', limit: '10' });
  });

  it('repeated access reuses _parsedUrl cache', () => {
    const req = makeReq('/products?sort=asc');

    expect((req as any)._parsedUrl).toBeUndefined();

    const p1 = (req as any).path;
    const cached = (req as any)._parsedUrl;
    expect(cached).toBeDefined();

    const p2 = (req as any).path;
    const q1 = (req as any).query;
    const q2 = (req as any).query;

    expect(p1).toBe('/products');
    expect(p2).toBe('/products');
    expect(q1).toEqual({ sort: 'asc' });
    expect(q2).toEqual({ sort: 'asc' });
    // Same object reference — proves no re-parse
    expect((req as any)._parsedUrl).toBe(cached);
  });

  it('handles malformed URL gracefully without throwing', () => {
    const req = makeReq('not-a-url');
    expect(() => (req as any).path).not.toThrow();
    expect((req as any).path).toBe('/not-a-url');
    expect((req as any).query).toEqual({});
  });

  it('returns empty query for URL with no query string', () => {
    const req = makeReq('/about');
    expect((req as any).query).toEqual({});
  });
});
