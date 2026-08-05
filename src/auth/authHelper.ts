import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

type BcryptModule = typeof import('bcrypt');

function getBcrypt(): BcryptModule {
  try {
    return require('bcrypt') as BcryptModule;
  } catch {
    throw new Error('[mimijs] bcrypt is not installed. Run: npm install bcrypt');
  }
}

export interface TokenPayload {
  id: string | number;
  email: string;
}

// ─── Token store ─────────────────────────────────────────────────────────────

/**
 * Pluggable token version store.
 * Default: in-memory (single-process). Replace with a Redis / DB implementation
 * via setTokenStore() for distributed deployments.
 *
 * NOTE: verifyToken is synchronous — only sync implementations of `get` are
 * supported there. For async stores, do the version check in a custom middleware.
 */
export interface TokenStore {
  set(userId: string, version: string): void | Promise<void>;
  get(userId: string): string | null | Promise<string | null>;
  invalidate(userId: string): void | Promise<void>;
}

class InMemoryTokenStore implements TokenStore {
  private readonly store = new Map<string, string>();
  set(userId: string, version: string): void { this.store.set(userId, version); }
  get(userId: string): string | null { return this.store.get(userId) ?? null; }
  invalidate(userId: string): void { this.store.delete(userId); }
}

let _tokenStore: TokenStore = new InMemoryTokenStore();

/** Replace the default in-memory token store with a custom implementation (e.g. Redis). */
export function setTokenStore(store: TokenStore): void {
  _tokenStore = store;
}

// ─── Password helpers ─────────────────────────────────────────────────────────

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return getBcrypt().hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return getBcrypt().compare(password, hash);
}

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Generate a signed JWT for the given user.
 *
 * @param user      - Payload embedded in the token (id + email).
 * @param expiresIn - Expiry as a zeit/ms string ("30s", "1h", "7d") or seconds.
 *                    Defaults to "1h".
 *
 * Calling this a second time for the same user **invalidates** the previous token —
 * verifyToken will reject it on the next check.
 */
export function generateToken(
  user: TokenPayload,
  expiresIn: string | number = '1h',
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');

  const version = randomUUID();
  _tokenStore.set(String(user.id), version);

  return jwt.sign(
    { id: user.id, email: user.email, _v: version },
    secret,
    // jsonwebtoken v9 types use a branded StringValue; cast to bypass the mismatch
    { expiresIn: expiresIn as any, algorithm: 'HS256' },
  );
}

/**
 * Verify a JWT. Returns the decoded payload or null if the token is invalid,
 * expired, or has been superseded by a newer generateToken() call for the same user.
 */
export function verifyToken(token: string): TokenPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });

    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof (payload as any).id === 'undefined' ||
      typeof (payload as any).email !== 'string'
    ) {
      return null;
    }

    // Version check — rejects tokens superseded by a newer generateToken() call.
    // If an async store is installed, stored will be a Promise — treat as invalid to fail safe.
    const stored = _tokenStore.get(String((payload as any).id));
    if (stored instanceof Promise || typeof stored !== 'string' || stored !== (payload as any)._v) return null;

    // Strip internal fields before returning to the caller
    const { _v: _version, iat: _iat, exp: _exp, ...clean } = payload as any;
    return clean as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Explicitly invalidate all tokens for a user (e.g. on logout).
 * After this call, verifyToken will reject every previously-issued token for that user.
 */
export async function invalidateToken(userId: string | number): Promise<void> {
  await _tokenStore.invalidate(String(userId));
}
