import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

export interface SecurityOptions {
  contentSecurityPolicy?: false | string;
  xFrameOptions?: false | string;
  xContentTypeOptions?: false;
  xXssProtection?: false;
  dnsPrefetchControl?: false;
  permittedCrossDomainPolicies?: false | string;
  downloadOptions?: false;
  removePoweredBy?: false;
}

export function security(options: SecurityOptions = {}): RequestHandler {
  return function securityMiddleware(
    _req: MimiRequest,
    res: MimiResponse,
    next: NextFunction,
  ): void {
    if (options.contentSecurityPolicy !== false) {
      res.setHeader(
        'Content-Security-Policy',
        typeof options.contentSecurityPolicy === 'string'
          ? options.contentSecurityPolicy
          : "default-src 'self'",
      );
    }

    if (options.xFrameOptions !== false) {
      res.setHeader(
        'X-Frame-Options',
        typeof options.xFrameOptions === 'string' ? options.xFrameOptions : 'SAMEORIGIN',
      );
    }

    if (options.xContentTypeOptions !== false) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    if (options.xXssProtection !== false) {
      res.setHeader('X-XSS-Protection', '0');
    }

    if (options.dnsPrefetchControl !== false) {
      res.setHeader('X-DNS-Prefetch-Control', 'off');
    }

    if (options.permittedCrossDomainPolicies !== false) {
      res.setHeader(
        'X-Permitted-Cross-Domain-Policies',
        typeof options.permittedCrossDomainPolicies === 'string'
          ? options.permittedCrossDomainPolicies
          : 'none',
      );
    }

    if (options.downloadOptions !== false) {
      res.setHeader('X-Download-Options', 'noopen');
    }

    if (options.removePoweredBy !== false) {
      res.removeHeader('X-Powered-By');
    }

    next();
  };
}
