import http from 'http';
import mimeTypes from 'mime-types';
import type { MimiRequest } from '../types';

const req = http.IncomingMessage.prototype as unknown as MimiRequest;

// Default prototype values
(req as any).params = {};
(req as any).body = undefined;
(req as any).locals = {};

req.get = function (this: MimiRequest, name: string): string | undefined {
  const lc = name.toLowerCase();
  if (lc === 'referrer' || lc === 'referer') {
    return (this.headers['referrer'] ?? this.headers['referer']) as string | undefined;
  }
  return this.headers[lc] as string | undefined;
};

function getParsedUrl(r: MimiRequest): { pathname: string; query: Record<string, string> } {
  if ((r as any)._parsedUrl) return (r as any)._parsedUrl;
  try {
    const u = new URL(r.url ?? '/', 'http://x');
    const query: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    (r as any)._parsedUrl = { pathname: u.pathname, query };
  } catch {
    (r as any)._parsedUrl = { pathname: '/', query: {} };
  }
  return (r as any)._parsedUrl;
}

Object.defineProperty(req, 'query', {
  get(this: MimiRequest): Record<string, string> {
    return getParsedUrl(this).query;
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'path', {
  get(this: MimiRequest): string {
    return getParsedUrl(this).pathname;
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'hostname', {
  get(this: MimiRequest): string {
    return this.headers.host?.split(':')[0] ?? '';
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'ip', {
  get(this: MimiRequest): string {
    return this.socket?.remoteAddress ?? '';
  },
  configurable: true,
  enumerable: true,
});

req.is = function (this: MimiRequest, type: string): string | false {
  const contentType = this.headers['content-type'];
  if (!contentType) return false;
  const mimeType = mimeTypes.lookup(type);
  if (!mimeType) {
    // type might already be a full mime string like 'application/json'
    return contentType.startsWith(type) ? type : false;
  }
  return contentType.startsWith(mimeType) ? mimeType : false;
};

export {};
