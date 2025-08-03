import { InvalidParameterError, N2YOError, RateLimitError } from './errors'
import {
  COMMON_SATELLITES,
  SatelliteCategories,
  type AboveResponse,
  type CacheEntry,
  type N2YOClientConfig,
  type N2YOErrorResponse,
  type PositionsResponse,
  type RadioPassesResponse,
  type RateLimitState,
  type SatelliteCategoryId,
  type SatelliteCategoryName,
  type TleResponse,
  type VisualPassesResponse,
} from './types'

/**
 * A TypeScript client for the N2YO REST API, supporting Node, Deno, Bun, and browsers.
 *
 * @remarks
 * This class provides strongly-typed methods to interact with the [N2YO REST API](https://www.n2yo.com/api/),
 * including satellite TLEs, position predictions, visual/radio passes, and objects above a location.
 * All methods return native `Promise`s, automatically handle API key injection, and manage:
 * - **Rate-limiting**: Enforces N2YO’s 1000 requests/hour limit with optional queuing (throws {@link RateLimitError} on HTTP 429).
 * - **Caching**: Stores responses in an LRU cache with configurable TTL and size (default: 5 minutes, 100 entries).
 * - **Error handling**: Throws {@link N2YOError} for non-2xx responses or {@link InvalidParameterError} for invalid inputs.
 *
 * Common satellites can be queried by name using {@link getTleByName}. See {@link getTle}, {@link getPositions},
 * {@link getVisualPasses}, {@link getRadioPasses}, and {@link getAbove} for specific endpoints.
 *
 * @example
 * ```ts
 * import { N2YOClient } from 'n2yo-ts';
 *
 * const client = new N2YOClient('YOUR_API_KEY', { debug: true });
 *
 * // Fetch TLE for the International Space Station (ISS)
 * const issTle = await client.getTleByName('ISS'); // Uses NORAD ID 25544
 * console.log(issTle.tle);
 *
 * // Get satellite positions for the next 60 seconds
 * const positions = await client.getPositions(25544, 40.7128, -74.0060, 0, 60);
 * console.log(positions.positions);
 * ```
 *
 * @see {@link https://www.n2yo.com/api/} for API documentation.
 */
export class N2YOClient {
  /** Base URL for all requests. */
  private readonly baseUrl: string = 'https://api.n2yo.com/rest/v1/satellite'
  /** Private API key supplied at construction. */
  private readonly apiKey: string
  /** Config options */
  private readonly config: Required<N2YOClientConfig>

  // Cache implementation
  private cache = new Map<string, CacheEntry<any>>()

  private rateLimitState: RateLimitState = {
    requests: [],
    processing: false,
    queue: [],
  }

  /**
   * Create a new client instance.
   *
   * @param apiKey – your private N2YO API key. Must be non-empty.
   *
   * @throws {InvalidParameterError} If the key is missing or empty.
   *
   */
  constructor(apiKey: string, config: N2YOClientConfig = {}) {
    if (!apiKey) {
      throw new InvalidParameterError('apiKey', apiKey, 'API key is required')
    }
    this.apiKey = apiKey
    this.config = {
      debug: false,
      cache: {
        enabled: true,
        ttlMs: 5 * 60 * 1000, // 5 minutes
        maxEntries: 100,
        ...config.cache,
      },
      rateLimit: {
        enabled: true,
        requestsPerHour: 1000,
        queueRequests: true,
        ...config.rateLimit,
      },
      ...config,
    }

    if (this.config.cache.enabled) {
      setInterval(() => this.cleanupCache(), 60000) // Every minute
    }
  }

  /**
   * Generate cache key for a request
   */
  private getCacheKey(endpoint: string) {
    return endpoint.split('&apiKey=')[0] || endpoint
  }

  /**
   * Get cached response if available
   */
  private getCachedResponse<T>(cacheKey: string): T | null {
    if (!this.config.cache.enabled) return null
    const entry = this.cache.get(cacheKey)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey)
      return null
    }

    if (this.config.debug) {
      this.debugLog(`[N2YO] Cache HIT for: ${cacheKey}`)
    }

    return entry.data
  }

  /**
   * Cache a response
   */
  private setCachedResponse<T>(
    cacheKey: string,
    data: T,
    customTtl?: number,
  ): void {
    if (!this.config.cache.enabled) return

    // Implement LRU eviction if cache is full
    if (this.cache.size >= (this.config.cache.maxEntries ?? 100)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey as string)
      }
    }

    const ttl = customTtl ?? this.config.cache.ttlMs
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: ttl!, // Non-null assertion since ttl is guaranteed to be defined
    })

    if (this.config.debug) {
      this.debugLog(`[N2YO] Cached response for: ${cacheKey} (TTL: ${ttl}ms)`)
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (this.config.debug && cleaned > 0) {
      this.debugLog(`[N2YO] Cleaned up ${cleaned} expired cache entries`)
    }
  }

  /**
   * Check if we're within rate limits
   */
  private isWithinRateLimit(): boolean {
    if (!this.config.rateLimit.enabled) return true

    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    // Clean old requests
    this.rateLimitState.requests = this.rateLimitState.requests.filter(
      (timestamp) => timestamp > oneHourAgo,
    )

    return (
      this.rateLimitState.requests.length <
      (this.config.rateLimit.requestsPerHour ?? 1000)
    )
  }

  /**
   * Record a request for rate limiting
   */
  private recordRequest(): void {
    if (this.config.rateLimit.enabled) {
      this.rateLimitState.requests.push(Date.now())
    }
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (
      this.rateLimitState.processing ||
      this.rateLimitState.queue.length === 0
    ) {
      return
    }

    this.rateLimitState.processing = true

    while (this.rateLimitState.queue.length > 0 && this.isWithinRateLimit()) {
      const { resolve, reject, request } = this.rateLimitState.queue.shift()!

      try {
        const result = await request()
        resolve(result)
      } catch (error) {
        reject(error)
      }

      // Small delay between requests to be nice to the API
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    this.rateLimitState.processing = false

    // If there are still queued requests, schedule next processing
    if (this.rateLimitState.queue.length > 0) {
      setTimeout(() => this.processQueue(), 1000)
    }
  }

  /**
   * Generic helper that performs the actual HTTP request.
   *
   * @param endpoint – the path **including** query parameters (after `?`).
   * @returns Parsed JSON payload.
   *
   * @throws {RateLimitError} on HTTP 429.
   * @throws {N2YOError} for any other non-2xx response.
   */
  // eslint-disable-next-line require-await
  private async makeRequest<T>(
    endpoint: string,
    customCacheTtl?: number,
  ): Promise<T> {
    const cacheKey = this.getCacheKey(endpoint)

    // Try cache first
    const cached = this.getCachedResponse<T>(cacheKey)
    if (cached) {
      return Promise.resolve(cached)
    }

    // Check rate limiting
    if (!this.isWithinRateLimit()) {
      if (!this.config.rateLimit.queueRequests) {
        throw new RateLimitError('Rate limit exceeded and queueing is disabled')
      }

      if (this.config.debug) {
        this.debugLog(`[N2YO] Rate limited, queueing request: ${cacheKey}`)
      }

      // Queue the request
      return new Promise<T>((resolve, reject) => {
        this.rateLimitState.queue.push({
          resolve,
          reject,
          request: () =>
            this.makeActualRequest<T>(endpoint, cacheKey, customCacheTtl),
        })
        this.processQueue()
      })
    }

    return this.makeActualRequest<T>(endpoint, cacheKey, customCacheTtl)
  }

  /**
   * Make the actual HTTP request
   */
  private async makeActualRequest<T>(
    endpoint: string,
    cacheKey: string,
    customCacheTtl?: number,
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}&apiKey=${this.apiKey}`

    if (this.config.debug) {
      this.debugLog(`[N2YO] Making request to: ${cacheKey}`)
      // eslint-disable-next-line no-console
      console.time(`[N2YO] ${cacheKey}`)
    }

    this.recordRequest()

    try {
      const response = await fetch(url)

      if (this.config.debug) {
        // eslint-disable-next-line no-console
        console.timeEnd(`[N2YO] ${cacheKey}`)
        this.debugLog(`[N2YO] Response status: ${response.status}`)
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new RateLimitError('API rate limit exceeded')
        }

        // Try to parse N2YO error response
        try {
          const errorData = (await response.json()) as N2YOErrorResponse
          throw new N2YOError(
            `API request failed: ${errorData.error || response.statusText}`,
          )
        } catch {
          throw new N2YOError(`API request failed: ${response.statusText}`)
        }
      }

      const data = (await response.json()) as T

      // Cache the successful response
      this.setCachedResponse(cacheKey, data, customCacheTtl)

      return data
    } catch (error) {
      if (this.config.debug) {
        this.debugLog(`[N2YO] Request failed: ${error}`)
      }
      throw error
    }
  }

  /**
   * Retrieve the latest Two-Line Element set (TLE) for a satellite.
   *
   * @param id - NORAD catalog number (e.g., `25544` for the ISS).
   * @returns A `Promise` resolving to a {@link TleResponse} containing the satellite’s TLE data.
   * @throws {N2YOError} If the API request fails (e.g., invalid NORAD ID).
   * @throws {RateLimitError} If the API rate limit is exceeded (HTTP 429).
   *
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const tle = await client.getTle(25544); // ISS
   * console.log(tle.tle); // Outputs: "1 25544U 98067A   ..."
   * ```
   */
  getTle(id: number): Promise<TleResponse> {
    return this.makeRequest<TleResponse>(`tle/${id}`)
  }

  /**
   * Retrieve the latest Two-Line Element set (TLE) for a satellite by its common name.
   *
   * @param name - Common name of the satellite (e.g., 'ISS', 'HUBBLE').
   * @returns Promise resolving to {@link TleResponse}.
   * @throws {InvalidParameterError} If the satellite name is not recognized.
   *
   * @example
   * const tle = await client.getTleByName('ISS'); // Fetches TLE for NORAD ID 25544
   */
  getTleByName(name: string): Promise<TleResponse> {
    const noradId = COMMON_SATELLITES[name.toUpperCase()]
    if (!noradId) {
      throw new InvalidParameterError('name', name, 'Unknow satellite name')
    }
    return this.getTle(noradId)
  }

  /**
   * Predict future positions (“ground track”) for a satellite.
   *
   * @param id - NORAD catalog number (e.g., `25544` for the ISS).
   * @param observerLat - Observer latitude in decimal degrees (-90 to 90).
   * @param observerLng - Observer longitude in decimal degrees (-180 to 180).
   * @param observerAlt - Observer altitude above sea level in meters (e.g., `0` for sea level).
   * @param seconds - Seconds of prediction to return (1 to 300).
   * @returns A `Promise` resolving to a {@link PositionsResponse} with predicted satellite positions.
   * @throws {InvalidParameterError} If `seconds` is outside 1–300 or other parameters are invalid.
   * @throws {N2YOError} If the API request fails.
   * @throws {RateLimitError} If the API rate limit is exceeded (HTTP 429).
   *
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const positions = await client.getPositions(25544, 40.7128, -74.0060, 0, 60);
   * console.log(positions.positions); // Array of { satlatitude, satlongitude, ... }
   * ```
   */
  async getPositions(
    id: number,
    observerLat: number,
    observerLng: number,
    observerAlt: number,
    seconds: number,
  ): Promise<PositionsResponse> {
    if (seconds > 300) {
      throw new InvalidParameterError(
        'seconds',
        seconds,
        'Maximum number of seconds is 300',
      )
    }

    const response = await this.makeRequest<PositionsResponse>(
      `positions/${id}/${observerLat}/${observerLng}/${observerAlt}/${seconds}`,
    )
    if (!response.positions) {
      return { ...response, positions: [] }
    }
    return response
  }

  /**
   * Predict **visual** passes (sunlit, naked-eye visible) for a satellite.
   *
   * @param id – NORAD catalog number.
   * @param observerLat – observer latitude in decimal degrees.
   * @param observerLng – observer longitude in decimal degrees.
   * @param observerAlt – observer altitude **above sea level** in **meters**.
   * @param days – prediction window in days (max `10`).
   * @param minVisibility – minimum pass duration in seconds to be included.
   * @returns Promise resolving to {@link VisualPassesResponse}.
   *
   * @throws {@link InvalidParameterError} if `days > 10`.
   */
  async getVisualPasses(
    id: number,
    observerLat: number,
    observerLng: number,
    observerAlt: number,
    days: number,
    minVisibility: number,
  ): Promise<VisualPassesResponse> {
    if (days > 10) {
      throw new InvalidParameterError(
        'days',
        days,
        'Maximum number of days is 10',
      )
    }

    const response = await this.makeRequest<VisualPassesResponse>(
      `visualpasses/${id}/${observerLat}/${observerLng}/${observerAlt}/${days}/${minVisibility}`,
    )

    if (!response.passes) {
      return {
        ...response,
        passes: [],
        info: { ...response.info, passescount: 0 },
      }
    }
    return response
  }

  /**
   * Predict **radio** passes for a satellite (no sunlight requirement).
   *
   * @param id – NORAD catalog number.
   * @param observerLat – observer latitude in decimal degrees.
   * @param observerLng – observer longitude in decimal degrees.
   * @param observerAlt – observer altitude **above sea level** in **meters**.
   * @param days – prediction window in days (max `10`).
   * @param minElevation – minimum **maximum** elevation in degrees to be included.
   * @returns Promise resolving to {@link RadioPassesResponse}.
   *
   * @throws {@link InvalidParameterError} if `days > 10`.
   */
  async getRadioPasses(
    id: number,
    observerLat: number,
    observerLng: number,
    observerAlt: number,
    days: number,
    minElevation: number,
  ): Promise<RadioPassesResponse> {
    if (days > 10) {
      throw new InvalidParameterError(
        'days',
        days,
        'Maximum number of days is 10',
      )
    }

    const response = await this.makeRequest<RadioPassesResponse>(
      `radiopasses/${id}/${observerLat}/${observerLng}/${observerAlt}/${days}/${minElevation}`,
    )
    if (!response.passes) {
      return {
        ...response,
        passes: [],
        info: { ...response.info, passescount: 0 },
      }
    }
    return response
  }

  /**
   * List all catalogued objects above a given location.
   *
   * @param observerLat – observer latitude in decimal degrees.
   * @param observerLng – observer longitude in decimal degrees.
   * @param observerAlt – observer altitude **above sea level** in **meters**.
   * @param searchRadius – radius around the observer to search (0–90 °).
   * @param categoryId – satellite category to filter by (use `0` for all categories).
   * @returns Promise resolving to {@link AboveResponse}.
   *
   * @throws {@link InvalidParameterError} if `searchRadius` is outside 0–90 °.
   */
  async getAbove(
    observerLat: number,
    observerLng: number,
    observerAlt: number,
    searchRadius: number,
    categoryId: SatelliteCategoryId,
  ): Promise<AboveResponse> {
    if (searchRadius < 0 || searchRadius > 90) {
      throw new InvalidParameterError(
        'searchRadius',
        searchRadius,
        'Search radius must be between 0 and 90 degrees',
      )
    }

    try {
      const response = await this.makeRequest<AboveResponse>(
        `above/${observerLat}/${observerLng}/${observerAlt}/${searchRadius}/${categoryId}`,
      )
      if (!response.info || !response.above) {
        return {
          info: {
            category: this.getCategoryName(categoryId) || 'Unknown',
            transactionscount: response.info?.transactionscount || 0,
            satcount: 0,
          },
          above: [],
        }
      }
      return response
    } catch (error) {
      if (error instanceof N2YOError && error.message.includes('got null')) {
        return {
          info: {
            category: this.getCategoryName(categoryId) || 'Unknown',
            transactionscount: 0,
            satcount: 0,
          },
          above: [],
        }
      }
      throw error
    }
  }

  /**
   * Reverse-lookup a satellite category name from its numeric ID.
   *
   * @param categoryId – numeric category identifier (1–56).
   * @returns Human-readable category name or `undefined` if the ID is unknown.
   */
  getCategoryName(
    categoryId: SatelliteCategoryId,
  ): SatelliteCategoryName | undefined {
    return SatelliteCategories[categoryId]
  }

  /**
   * Convert a UTC Unix timestamp (seconds) to a local time string in the specified time zone.
   *
   * @param utcTimestamp – Unix timestamp in seconds (UTC).
   * @param timeZone – IANA time zone name (e.g., 'America/New_York').
   * @returns Formatted local time string (e.g., '2025-08-01 19:17:00').
   * @throws {InvalidParameterError} If the time zone is invalid or timestamp is not a number.
   *
   * @example
   * const localTime = client.utcToLocal(1711987840, 'America/New_York');
   * // Returns '2024-04-01 15:30:40' (depending on DST)
   */
  utcToLocal(utcTimestamp: number, timeZone: string): string {
    if (Number.isNaN(utcTimestamp) || !Number.isFinite(utcTimestamp)) {
      throw new InvalidParameterError(
        'utcTimestamp',
        utcTimestamp,
        'Invalid timestamp value',
      )
    }

    const date = new Date(utcTimestamp * 1000)

    if (!timeZone || timeZone.toUpperCase() === 'UTC') {
      return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`
    }

    try {
      const supportedTimeZones = Intl.supportedValuesOf('timeZone')
      if (!supportedTimeZones.includes(timeZone)) {
        console.warn(`Invalid time zone '${timeZone}'. Falling back to UTC.`)
        return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`
      }

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      const parts = formatter.formatToParts(date)
      const year = parts.find((p) => p.type === 'year')!.value
      const month = parts.find((p) => p.type === 'month')!.value
      const day = parts.find((p) => p.type === 'day')!.value
      const hour = parts.find((p) => p.type === 'hour')!.value
      const minute = parts.find((p) => p.type === 'minute')!.value
      const second = parts.find((p) => p.type === 'second')!.value
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`
    } catch (error) {
      console.warn(
        `Failed to format time zone '${timeZone}': ${error}. Falling back to UTC.`,
      )
      return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`
    }
  }

  private debugLog(message: string): void {
    if (this.config.debug) {
      console.info(`[N2YO] ${message}`)
    }
  }
}
