import type { CacheEntry, N2YOClientConfig } from './types'

export class Cache {
  private cache = new Map<string, CacheEntry<any>>()
  private config: Required<N2YOClientConfig>
  private cleanupInterval?: NodeJS.Timeout

  constructor(config: Required<N2YOClientConfig>) {
    this.config = {
      ...config,
      cache: {
        maxEntries: 100,
        cleanupIntervalMs: 60000,
        ...config.cache,
      },
    }

    if (this.config.cache.enabled) {
      this.setupCleanupInterval(this.config.cache.cleanupIntervalMs ?? 60000)
    }
  }

  private setupCleanupInterval(intervalMs: number) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), intervalMs)
  }

  getCacheKey(endpoint: string): string {
    if (this.config.debug) {
      this.log(`Generating cache key for endpoint: ${endpoint}`)
    }
    try {
      const url = new URL(
        endpoint.includes('://') ? endpoint : `http://dummy.base${endpoint}`,
      )

      url.searchParams.delete('apiKey')
      url.searchParams.sort()
      const key = `${url.pathname}${url.search}`
      if (this.config.debug) {
        this.log(`Generated cache key: ${key}`)
      }
      return key
    } catch (error) {
      console.warn('getCacheKey fallback called', error)
      const key = endpoint.split('?')[0]?.split('&apiKey=')[0] ?? endpoint
      if (this.config.debug) {
        this.log(`Fallback cache key: ${key}`)
      }
      return key
    }
  }

  get<T>(cacheKey: string): T | null {
    if (!this.config.cache.enabled) return null

    const entry = this.cache.get(cacheKey)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey)
      return null
    }

    if (this.config.debug) {
      this.log(`Cache HIT for: ${cacheKey}`)
    }
    return entry.data
  }

  set<T>(cacheKey: string, data: T, customTtl?: number): void {
    if (!this.config.cache.enabled) return

    const ttl = Math.min(
      customTtl ?? this.config.cache.ttlMs,
      this.config.cache.ttlMs,
    )

    if (this.cache.size >= (this.config.cache.maxEntries ?? 100)) {
      this.evictEntries()
    }

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    })

    if (this.config.debug) {
      this.log(`Cached response for: ${cacheKey} (TTL: ${ttl}ms)`)
    }
  }

  private evictEntries() {
    const firstKey = this.cache.keys().next().value
    if (firstKey !== undefined) {
      this.cache.delete(firstKey)
    }
  }

  cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (this.config.debug && cleaned > 0) {
      this.log(`Cleaned up ${cleaned} expired cache entries`)
    }
  }

  clear(): void {
    this.cache.clear()
    if (this.config.debug) {
      this.log('Cache cleared')
    }
  }

  getStats() {
    const now = Date.now()
    let expired = 0

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++
      }
    }

    return {
      total: this.cache.size,
      expired,
      valid: this.cache.size - expired,
      maxEntries: this.config.cache.maxEntries,
    }
  }

  private log(message: string) {
    if (this.config.debug) this.config.debugLog(`[Cache] ${message}`)
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }

  static normalizeKey(endpoint: string): string {
    try {
      // Si no tiene protocolo, agrega uno dummy
      const url = new URL(
        endpoint.includes('://') ? endpoint : `http://dummy.base${endpoint}`,
      )

      // Elimina parámetros volátiles como apiKey
      url.searchParams.delete('apiKey')

      // Ordena los parámetros para consistencia
      url.searchParams.sort()

      // Devuelve solo el pathname y los search params ordenados
      return `${url.pathname}${url.search}`
    } catch (error) {
      console.warn('getCacheKey fallback called', error)
      return endpoint // última opción: devuelve el raw
    }
  }
}
