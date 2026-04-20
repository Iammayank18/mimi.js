import jwt from 'jsonwebtoken';

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

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return getBcrypt().hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return getBcrypt().compare(password, hash);
}

export function generateToken(user: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '1h' });
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}
