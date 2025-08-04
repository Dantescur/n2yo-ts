import { beforeEach, describe, expect, it, vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import { Cache } from '../src/cache'
import { RateLimitError } from '../src/errors'
import { makeRequest } from '../src/http'
import type { N2YOClientConfig } from '../src/types'

const fetchMocker = createFetchMock(vi)

describe('makeRequest', () => {
  const config: Required<N2YOClientConfig> = {
    debug: false,
    debugLog: vi.fn(),
    cache: { enabled: true, ttlMs: 1000, maxEntries: 100 },
  }
  let cache: Cache

  beforeEach(() => {
    fetchMocker.enableMocks()
    fetchMocker.resetMocks()
    cache = new Cache(config)
  })

  it('should make successful request', async () => {
    const mockResponse = { data: 'test' }
    fetchMocker.mockResponseOnce(JSON.stringify(mockResponse))
    const result = await makeRequest(
      'https://api.n2yo.com/rest/v1/satellite',
      'TEST_API_KEY',
      config,
      cache,
      'test/endpoint',
    )
    expect(result).toEqual(mockResponse)
    expect(fetchMocker).toHaveBeenCalledWith(
      'https://api.n2yo.com/rest/v1/satellite/test/endpoint&apiKey=TEST_API_KEY',
    )
  })

  it('should use cached response', async () => {
    cache.set(cache.getCacheKey('test/endpoint'), { data: 'cached' })
    const result = await makeRequest(
      'https://api.n2yo.com/rest/v1/satellite',
      'TEST_API_KEY',
      config,
      cache,
      'test/endpoint',
    )
    expect(result).toEqual({ data: 'cached' })
    expect(fetchMocker).not.toHaveBeenCalled()
  })

  it('should throw RateLimitError on 429', async () => {
    fetchMocker.mockResponseOnce('', { status: 429 })
    await expect(
      makeRequest(
        'https://api.n2yo.com/rest/v1/satellite',
        'TEST_API_KEY',
        config,
        cache,
        'test/endpoint',
      ),
    ).rejects.toThrowError(RateLimitError)
  })

  it('should throw N2YOError on non-2xx response', async () => {
    // Mock a response with JSON content
    fetchMocker.mockResponseOnce(JSON.stringify({ error: 'API error' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(
      makeRequest(
        'https://api.n2yo.com/rest/v1/satellite',
        'TEST_API_KEY',
        config,
        cache,
        'test/endpoint',
      ),
    ).rejects.toThrowError('API request failed: API error')
  })
})
