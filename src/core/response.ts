import http from 'http';
import path from 'path';
import send from 'send';
import vary from 'vary';
import accepts from 'accepts';
import { serialize as serializeCookie } from 'cookie';
import mimeTypes from 'mime-types';
import type { MimiResponse, CookieOptions, SendFileOptions } from '../types';

const res = http.ServerResponse.prototype as unknown as MimiResponse;

res.locals = {};

// ─── Status ───────────────────────────────────────────────────────────────────

res.status = function (this: MimiResponse, code: number): MimiResponse {
  this.statusCode = code;
  return this;
};

// ─── Headers ─────────────────────────────────────────────────────────────────

res.set = function (
  this: MimiResponse,
  field: string | Record<string, string>,
  value?: string,
): MimiResponse {
  if (typeof field === 'object') {
    Object.entries(field).forEach(([k, v]) => this.setHeader(k, v));
  } else {
    this.setHeader(field, value as string);
  }
  return this;
};

res.header = res.set;

res.get = function (this: MimiResponse, field: string): string | undefined {
  return this.getHeader(field) as string | undefined;
};

res.append = function (this: MimiResponse, field: string, value: string | string[]): MimiResponse {
  const existing = this.getHeader(field);
  const vals = Array.isArray(value) ? value : [value];
  if (existing) {
    const prev = Array.isArray(existing) ? existing : [String(existing)];
    this.setHeader(field, [...prev, ...vals]);
  } else {
    this.setHeader(field, vals.length === 1 ? vals[0] : vals);
  }
  return this;
};

// ─── Content type ─────────────────────────────────────────────────────────────

res.type = function (this: MimiResponse, contentType: string): MimiResponse {
  const mime = mimeTypes.contentType(contentType) || contentType;
  this.setHeader('Content-Type', mime);
  return this;
};

res.contentType = res.type;

// ─── Body senders ─────────────────────────────────────────────────────────────

res.json = function (this: MimiResponse, obj: unknown): void {
  const body = JSON.stringify(obj);
  if (!this.getHeader('Content-Type')) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  this.setHeader('Content-Length', Buffer.byteLength(body));
  this.end(body);
};

res.jsonp = function (this: MimiResponse, obj: unknown): void {
  const req = (this as any).req;
  const callbackName = (req?.query?.callback as string) || 'callback';
  const safe = callbackName.replace(/[^[\]\w$.]/g, '');
  const body = `/**/ typeof ${safe} === 'function' && ${safe}(${JSON.stringify(obj)});`;
  if (!this.getHeader('Content-Type')) {
    this.setHeader('X-Content-Type-Options', 'nosniff');
    this.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  }
  this.setHeader('Content-Length', Buffer.byteLength(body));
  this.end(body);
};

res.send = function (this: MimiResponse, body: unknown): void {
  if (body === null || body === undefined) {
    this.end();
    return;
  }

  if (Buffer.isBuffer(body)) {
    if (!this.getHeader('Content-Type')) {
      this.setHeader('Content-Type', 'application/octet-stream');
    }
    this.setHeader('Content-Length', body.length);
    this.end(body);
    return;
  }

  if (typeof body === 'object') {
    this.json(body);
    return;
  }

  const str = String(body);
  if (!this.getHeader('Content-Type')) {
    this.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
  this.setHeader('Content-Length', Buffer.byteLength(str));
  this.end(str);
};

res.sendStatus = function (this: MimiResponse, code: number): void {
  const text = http.STATUS_CODES[code] ?? String(code);
  this.statusCode = code;
  this.setHeader('Content-Type', 'text/plain; charset=utf-8');
  this.end(text);
};

// ─── File sending ─────────────────────────────────────────────────────────────

res.sendFile = function (
  this: MimiResponse,
  filePath: string,
  options: SendFileOptions = {},
  callback?: (err?: Error) => void,
): void {
  const { headers, ...sendOptions } = options;
  const stream = send((this as any).req, filePath, sendOptions);

  if (headers) {
    stream.on('headers', (_res: http.ServerResponse) => {
      Object.entries(headers).forEach(([k, v]) => _res.setHeader(k, v));
    });
  }

  stream.on('error', (err: Error & { status?: number }) => {
    if (callback) return callback(err);
    this.statusCode = err.status ?? 500;
    this.end(err.message);
  });

  stream.on('finish', () => {
    if (callback) callback();
  });

  stream.pipe(this as any);
};

res.download = function (
  this: MimiResponse,
  filePath: string,
  filename?: string | ((err?: Error) => void),
  options?: SendFileOptions | ((err?: Error) => void),
  callback?: (err?: Error) => void,
): void {
  let name: string;
  let opts: SendFileOptions;
  let cb: ((err?: Error) => void) | undefined;

  if (typeof filename === 'function') {
    cb = filename;
    name = path.basename(filePath);
    opts = {};
  } else if (typeof options === 'function') {
    cb = options;
    name = filename ?? path.basename(filePath);
    opts = {};
  } else {
    name = filename ?? path.basename(filePath);
    opts = options ?? {};
    cb = callback;
  }

  this.attachment(name);
  this.sendFile(filePath, opts, cb);
};

// ─── Attachment / disposition ─────────────────────────────────────────────────

res.attachment = function (this: MimiResponse, filename?: string): MimiResponse {
  if (filename) {
    const ext = path.extname(filename);
    if (ext && !this.getHeader('Content-Type')) {
      this.type(ext);
    }
    this.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`);
  } else {
    this.setHeader('Content-Disposition', 'attachment');
  }
  return this;
};

// ─── Redirect ─────────────────────────────────────────────────────────────────

res.redirect = function (this: MimiResponse, url: string, status = 302): void {
  if (url === 'back') {
    url = ((this as any).req?.headers?.referer as string) || '/';
  }
  this.statusCode = status;
  this.setHeader('Location', url);
  const body = `<p>Redirecting to <a href="${url}">${url}</a></p>`;
  this.setHeader('Content-Type', 'text/html; charset=utf-8');
  this.setHeader('Content-Length', Buffer.byteLength(body));
  this.end(body);
};

// ─── Location / Vary / Links ──────────────────────────────────────────────────

res.location = function (this: MimiResponse, url: string): MimiResponse {
  if (url === 'back') {
    url = ((this as any).req?.headers?.referer as string) || '/';
  }
  this.setHeader('Location', url);
  return this;
};

res.vary = function (this: MimiResponse, field: string): MimiResponse {
  vary(this as any, field);
  return this;
};

res.links = function (this: MimiResponse, links: Record<string, string>): MimiResponse {
  const link = Object.entries(links)
    .map(([rel, url]) => `<${url}>; rel="${rel}"`)
    .join(', ');
  const existing = this.getHeader('Link');
  this.setHeader('Link', existing ? `${existing}, ${link}` : link);
  return this;
};

// ─── Cookies ─────────────────────────────────────────────────────────────────

res.cookie = function (
  this: MimiResponse,
  name: string,
  value: string | Record<string, unknown>,
  options: CookieOptions = {},
): MimiResponse {
  const opts = { path: '/', ...options };
  const val = typeof value === 'object' ? 'j:' + JSON.stringify(value) : String(value);

  const cookieStr = serializeCookie(name, val, {
    ...opts,
    sameSite: opts.sameSite as 'strict' | 'lax' | 'none' | boolean | undefined,
  });

  const existing = this.getHeader('Set-Cookie');
  const cookies = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
  this.setHeader('Set-Cookie', [...cookies, cookieStr]);
  return this;
};

res.clearCookie = function (
  this: MimiResponse,
  name: string,
  options: CookieOptions = {},
): MimiResponse {
  const opts: CookieOptions = { path: '/', ...options, expires: new Date(1), maxAge: 0 };
  return this.cookie(name, '', opts);
};

// ─── Content negotiation ─────────────────────────────────────────────────────

res.format = function (this: MimiResponse, obj: Record<string, () => void>): void {
  const req = (this as any).req;
  const keys = Object.keys(obj).filter((k) => k !== 'default');
  const acc = accepts(req);
  const matched = acc.type(keys);
  const key = Array.isArray(matched) ? matched[0] : matched;

  if (key) {
    this.set('Content-Type', key);
    obj[key]();
  } else if (obj['default']) {
    obj['default']();
  } else {
    const err = new Error('Not Acceptable') as Error & { status: number };
    err.status = 406;
    throw err;
  }
};

export {};
