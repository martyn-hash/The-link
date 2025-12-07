interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export class TTLCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private readonly defaultTTL: number;
  private readonly name: string;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(name: string, defaultTTLMs: number = 5 * 60 * 1000) {
    this.name = name;
    this.defaultTTL = defaultTTLMs;
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    this.stats.size = this.cache.size;
    if (cleaned > 0) {
      console.log(`[Cache:${this.name}] Cleaned ${cleaned} expired entries, ${this.cache.size} remaining`);
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      console.log(`[Cache:${this.name}] MISS for key: ${key.substring(0, 20)}...`);
      return undefined;
    }
    
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      console.log(`[Cache:${this.name}] EXPIRED for key: ${key.substring(0, 20)}...`);
      return undefined;
    }
    
    this.stats.hits++;
    console.log(`[Cache:${this.name}] HIT for key: ${key.substring(0, 20)}...`);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    this.stats.size = this.cache.size;
    console.log(`[Cache:${this.name}] SET key: ${key.substring(0, 20)}... (TTL: ${ttl / 1000}s, size: ${this.cache.size})`);
  }

  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    if (deleted) {
      console.log(`[Cache:${this.name}] INVALIDATED key: ${key.substring(0, 20)}...`);
    }
    return deleted;
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    if (count > 0) {
      console.log(`[Cache:${this.name}] INVALIDATED ${count} entries with prefix: ${prefix}`);
    }
    return count;
  }

  invalidateAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    console.log(`[Cache:${this.name}] INVALIDATED ALL (${count} entries)`);
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

export const stageConfigCache = new TTLCache<any>('StageConfig', 5 * 60 * 1000);

export const outlookAvailabilityCache = new TTLCache<boolean>('OutlookAvailability', 10 * 60 * 1000);
