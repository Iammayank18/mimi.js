import type { KVStore } from './types';

interface Entry {
  value: unknown;
  expires: number;
}

/**
 * Default in-process store. Fine for a single instance and for tests.
 * For multiple instances, pass a Redis-backed KVStore (setIfAbsent = SET NX PX).
 */
export class MemoryStore implements KVStore {
  private map = new Map<string, Entry>();
  private sweepAt = 0;

  private alive(key: string): Entry | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expires && e.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e;
  }

  private sweep(): void {
    const now = Date.now();
    if (now < this.sweepAt) return;
    this.sweepAt = now + 60_000;
    for (const [k, e] of this.map) if (e.expires && e.expires <= now) this.map.delete(k);
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.alive(key)?.value as T | undefined;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    this.sweep();
    this.map.set(key, { value, expires: ttlMs ? Date.now() + ttlMs : 0 });
  }

  async setIfAbsent(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    if (this.alive(key)) return false;
    await this.set(key, value, ttlMs);
    return true;
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  /** Keys with a prefix — used for activity listings in the in-memory store only. */
  keys(prefix: string): string[] {
    const out: string[] = [];
    for (const k of this.map.keys()) if (k.startsWith(prefix) && this.alive(k)) out.push(k);
    return out;
  }
}
