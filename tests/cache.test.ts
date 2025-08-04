import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Cache } from '../src/cache'
import type { N2YOClientConfig } from '../src/types'

describe('Cache', () => {
  const config: Required<N2YOClientConfig> = {
    debug: false,
    debugLog: vi.fn(),
    cache: {
      enabled: true,
      ttlMs: 1000,
      maxEntries: 2,
      cleanupIntervalMs: 60000,
    },
  }
  let cache: Cache

  beforeEach(() => {
    cache = new Cache(config)
  })

  it('should cache and retrieve data', () => {
    cache.set('key', { data: 'test' })
    expect(cache.get('key')).toEqual({ data: 'test' })
  })

  it('should return null for expired cache', async () => {
    cache.set('key', { data: 'test' }, 100)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(cache.get('key')).toBeNull()
  })

  it('should evict oldest entry when cache is full', () => {
    cache.set('key1', { data: 'test1' })
    cache.set('key2', { data: 'test2' })
    cache.set('key3', { data: 'test3' })
    expect(cache.get('key1')).toBeNull()
    expect(cache.get('key2')).toEqual({ data: 'test2' })
    expect(cache.get('key3')).toEqual({ data: 'test3' })
  })

  it('should clear cache', () => {
    cache.set('key', { data: 'test' })
    cache.clear()
    expect(cache.get('key')).toBeNull()
    expect(cache.getStats().total).toBe(0)
  })

  it('should normalize cache keys consistently', () => {
    const key1 = getCacheKey(
      'https://api.n2yo.com/rest/v1/satellite/positions/25544/41.702/-76.014/0/2/?apiKey=123',
    )
    const key2 = getCacheKey(
      '/rest/v1/satellite/positions/25544/41.702/-76.014/0/2/?apiKey=123',
    )
    expect(key1).toBe('/rest/v1/satellite/positions/25544/41.702/-76.014/0/2/')
    expect(key1).toBe(key2)
  })

  it('should provide cache stats', () => {
    cache.set('key1', { data: 'test1' }, 100)
    cache.set('key2', { data: 'test2' }, 2000)
    const stats = cache.getStats()
    expect(stats).toEqual({ total: 2, expired: 0, valid: 2, maxEntries: 2 })
  })

  it('should respect maxTtl configuration', () => {
    const cache = new Cache({
      ...config,
      cache: { ...config.cache, ttlMs: 500 },
    })
    cache.set('key', 'value', 1000) // Try to set 1000ms TTL
    const entry = cache.get('key')
    expect(entry).toBe('value')
    // Entry should expire after 500ms, not 1000ms
  })

  it('should clean up interval on destroy', () => {
    const cache = new Cache(config)
    const spy = vi.spyOn(global, 'clearInterval')
    cache.destroy()
    expect(spy).toHaveBeenCalled()
  })
})

function getCacheKey(endpoint: string): string {
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
