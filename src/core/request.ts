import http from 'http';
import accepts from 'accepts';
import fresh from 'fresh';
import parseRange from 'range-parser';
import mimeTypes from 'mime-types';
import type { MimiRequest } from '../types';

const req = http.IncomingMessage.prototype as unknown as MimiRequest;

(req as any).params = {};
(req as any).body = undefined;
(req as any).locals = {};

// ─── Header access ────────────────────────────────────────────────────────────

req.get = function (this: MimiRequest, name: string): string | undefined {
  const lc = name.toLowerCase();
  if (lc === 'referrer' || lc === 'referer') {
    return (this.headers['referrer'] ?? this.headers['referer']) as string | undefined;
  }
  return this.headers[lc] as string | undefined;
};

req.header = req.get;

// ─── URL parsing (cached) ─────────────────────────────────────────────────────

function getParsedUrl(r: MimiRequest): { pathname: string; query: Record<string, string> } {
  const currentUrl = r.url ?? '/';
  const cached = (r as any)._parsedUrl;
  if (cached && cached._rawUrl === currentUrl) return cached;
  try {
    const u = new URL(currentUrl, 'http://x');
    const query: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    (r as any)._parsedUrl = { _rawUrl: currentUrl, pathname: u.pathname, query };
  } catch {
    (r as any)._parsedUrl = { _rawUrl: currentUrl, pathname: '/', query: {} };
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

// ─── Host / protocol ──────────────────────────────────────────────────────────

Object.defineProperty(req, 'hostname', {
  get(this: MimiRequest): string {
    return (this.headers.host ?? '').split(':')[0];
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'host', {
  get(this: MimiRequest): string {
    return this.headers.host ?? '';
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'protocol', {
  get(this: MimiRequest): string {
    const socket = this.socket as any;
    if (socket?.encrypted) return 'https';
    const fwdProto = this.headers['x-forwarded-proto'];
    if (typeof fwdProto === 'string') return fwdProto.split(',')[0].trim();
    return 'http';
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'secure', {
  get(this: MimiRequest): boolean {
    return this.protocol === 'https';
  },
  configurable: true,
  enumerable: true,
});

// ─── IP / forwarded addresses ─────────────────────────────────────────────────

Object.defineProperty(req, 'ip', {
  get(this: MimiRequest): string {
    return this.ips[0] ?? this.socket?.remoteAddress ?? '';
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'ips', {
  get(this: MimiRequest): string[] {
    const fwd = this.headers['x-forwarded-for'];
    if (!fwd) return [];
    const raw = Array.isArray(fwd) ? fwd.join(',') : fwd;
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'subdomains', {
  get(this: MimiRequest): string[] {
    const hostname = this.hostname;
    if (!hostname) return [];
    const parts = hostname.split('.');
    if (parts.length <= 2) return [];
    return parts.slice(0, parts.length - 2).reverse();
  },
  configurable: true,
  enumerable: true,
});

// ─── Cache freshness ──────────────────────────────────────────────────────────

Object.defineProperty(req, 'fresh', {
  get(this: MimiRequest): boolean {
    const method = this.method;
    if (method !== 'GET' && method !== 'HEAD') return false;
    const res = (this as any).res;
    if (!res) return false;
    const status: number = res.statusCode;
    if ((status >= 200 && status < 300) || status === 304) {
      return fresh(this.headers as Record<string, string>, {
        etag: res.getHeader('ETag') as string | undefined,
        'last-modified': res.getHeader('Last-Modified') as string | undefined,
      });
    }
    return false;
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'stale', {
  get(this: MimiRequest): boolean {
    return !this.fresh;
  },
  configurable: true,
  enumerable: true,
});

// ─── XHR detection ───────────────────────────────────────────────────────────

Object.defineProperty(req, 'xhr', {
  get(this: MimiRequest): boolean {
    return this.get('X-Requested-With')?.toLowerCase() === 'xmlhttprequest';
  },
  configurable: true,
  enumerable: true,
});

// ─── Content negotiation ─────────────────────────────────────────────────────

req.accepts = function (this: MimiRequest, ...args: any[]): any {
  const acc = accepts(this as any);
  const types = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return types.length === 0 ? acc.types() : acc.type(types);
};

req.acceptsEncodings = function (this: MimiRequest, ...args: any[]): any {
  const acc = accepts(this as any);
  const encs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return encs.length === 0 ? acc.encodings() : acc.encoding(encs);
};

req.acceptsCharsets = function (this: MimiRequest, ...args: any[]): any {
  const acc = accepts(this as any);
  const chars = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return chars.length === 0 ? acc.charsets() : acc.charset(chars);
};

req.acceptsLanguages = function (this: MimiRequest, ...args: any[]): any {
  const acc = accepts(this as any);
  const langs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return langs.length === 0 ? acc.languages() : acc.language(langs);
};

// ─── Content type check ───────────────────────────────────────────────────────

req.is = function (this: MimiRequest, type: string): string | false {
  const contentType = this.headers['content-type'];
  if (!contentType) return false;
  const mimeType = mimeTypes.lookup(type);
  if (!mimeType) {
    return contentType.startsWith(type) ? type : false;
  }
  return contentType.startsWith(mimeType) ? mimeType : false;
};

// ─── Range parsing ────────────────────────────────────────────────────────────

req.range = function (this: MimiRequest, size: number, options?: { combine?: boolean }): any {
  const rangeHeader = this.get('Range');
  if (!rangeHeader) return undefined;
  return parseRange(size, rangeHeader, options);
};

export {};
