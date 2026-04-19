import http from 'http';
import mimeTypes from 'mime-types';
import type { MimiResponse } from '../types';

const res = http.ServerResponse.prototype as unknown as MimiResponse;

res.locals = {};

res.status = function (this: MimiResponse, code: number): MimiResponse {
  this.statusCode = code;
  return this;
};

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

res.type = function (this: MimiResponse, contentType: string): MimiResponse {
  const mime = mimeTypes.contentType(contentType) || contentType;
  this.setHeader('Content-Type', mime);
  return this;
};

res.json = function (this: MimiResponse, obj: unknown): void {
  const body = JSON.stringify(obj);
  if (!this.getHeader('Content-Type')) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
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

res.redirect = function (this: MimiResponse, url: string, status = 302): void {
  this.statusCode = status;
  this.setHeader('Location', url);
  const body = `<p>Redirecting to <a href="${url}">${url}</a></p>`;
  this.setHeader('Content-Type', 'text/html; charset=utf-8');
  this.setHeader('Content-Length', Buffer.byteLength(body));
  this.end(body);
};

res.sendStatus = function (this: MimiResponse, code: number): void {
  const text = http.STATUS_CODES[code] ?? String(code);
  this.statusCode = code;
  this.setHeader('Content-Type', 'text/plain; charset=utf-8');
  this.end(text);
};

export {};
