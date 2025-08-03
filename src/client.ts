import z from 'zod'
import { InvalidParameterError, N2YOError, RateLimitError } from './errors'
import {
  GetAboveParamsSchema,
  GetPositionsParamsSchema,
  GetRadioPassesParamsSchema,
  GetTleByNameParamsSchema,
  GetTleParamsSchema,
  GetVisualPassesParamsSchema,
  mapZodErrorToInvalidParameterError,
  UtcToLocalParamsSchema,
} from './schemas'
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
 * - **Input validation**: Uses Zod for robust, type-safe parameter validation.
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
 *
 * // Convert UTC timestamp to local time
 * const localTime = client.utcToLocal(1711987840, 'America/New_York');
 * console.log(localTime); // e.g., "2024-04-01 15:30:40"
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
   * @throws {InvalidParameterError} If `id` is not a positive integer.
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
    try {
      GetTleParamsSchema.parse({ id })
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error)
      }
      throw error
    }
    return this.makeRequest<TleResponse>(`tle/${id}`, 30 * 60 * 1000)
  }

  /**
   * Retrieve the latest Two-Line Element set (TLE) for a satellite by its common name.
   *
   * @param name - Common name of the satellite (e.g., 'ISS', 'HUBBLE').
   * @returns A `Promise` resolving to a {@link TleResponse} containing the satellite’s TLE data.
   * @throws {InvalidParameterError} If the satellite name is empty or not recognized.
   * @throws {N2YOError} If the API request fails.
   * @throws {RateLimitError} If the API rate limit is exceeded (HTTP 429).
   *
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const tle = await client.getTleByName('ISS'); // Fetches TLE for NORAD ID 25544
   * console.log(tle.tle); // Outputs: "1 25544U 98067A   ..."
   * ```
   */
  getTleByName(name: string): Promise<TleResponse> {
    let validatedName: string
    try {
      validatedName = GetTleByNameParamsSchema.parse({ name }).name
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error)
      }
      throw error
    }
    const noradId = COMMON_SATELLITES[validatedName]
    if (!noradId) {
      throw new InvalidParameterError('name', name, 'Unknow satellite name')
    }
    return this.getTle(noradId)
  }

  /**
   * Predict future positions (“ground track”) for a satellite.
   *
   * @remarks Inputs are validated using Zod for type safety and API compliance.
   * @param id - NORAD catalog number (e.g., `25544` for the ISS).
   * @param observerLat - Observer latitude in decimal degrees (-90 to 90).
   * @param observerLng - Observer longitude in decimal degrees (-180 to 180).
   * @param observerAlt - Observer altitude above sea level in meters (-1000 to 10000).
   * @param seconds - Seconds of prediction to return (1 to 300).
   * @returns A `Promise` resolving to a {@link PositionsResponse} with predicted satellite positions.
   * @throws {InvalidParameterError} If inputs are invalid (e.g., `seconds > 300`, invalid latitude).
   * @throws {N2YOError} If the API request fails or returns null data.
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
    try {
      GetPositionsParamsSchema.parse({
        id,
        observerLat,
        observerLng,
        observerAlt,
        seconds,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error)
      }
      throw error
    }

    try {
      const response = await this.makeRequest<PositionsResponse>(
        `positions/${id}/${observerLat}/${observerLng}/${observerAlt}/${seconds}`,
        2 * 60 * 1000,
      )
      if (!response.positions) {
        return { ...response, positions: [] }
      }
      return response
    } catch (error) {
      if (error instanceof N2YOError && error.message.includes('got null')) {
        return {
          info: { satcount: 0, transactionscount: 0, satid: 0, satname: '' },
          positions: [],
        }
      }
      throw error
    }
  }

  /**
   * Predict visual passes (sunlit, naked-eye visible) for a satellite.
   * @param id - NORAD catalog number (e.g., `25544` for the ISS).
   * @param observerLat - Observer latitude in decimal degrees (-90 to 90).
   * @param observerLng - Observer longitude in decimal degrees (-180 to 180).
   * @param observerAlt - Observer altitude above sea level in meters (-1000 to 10000).
   * @param days - Prediction window in days (1 to 10).
   * @param minVisibility - Minimum pass duration in seconds to include (positive).
   * @returns A `Promise` resolving to a {@link VisualPassesResponse} with predicted visual passes.
   * @throws {InvalidParameterError} If inputs are invalid (e.g., `days > 10`, invalid latitude).
   * @throws {N2YOError} If the API request fails or returns null data.
   * @throws {RateLimitError} If the API rate limit is exceeded (HTTP 429).
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const passes = await client.getVisualPasses(25544, 40.7128, -74.0060, 0, 7, 30);
   * console.log(passes.passes); // Array of { startAz, endAz, startUTC, ... }
   * ```
   */
  async getVisualPasses(
    id: number,
    observerLat: number,
    observerLng: number,
    observerAlt: number,
    days: number,
    minVisibility: number,
  ): Promise<VisualPassesResponse> {
    try {
      GetVisualPassesParamsSchema.parse({
        id,
        observerLat,
        observerLng,
        observerAlt,
        days,
        minVisibility,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error)
      }
      throw error
    }

    try {
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
    } catch (error) {
      if (error instanceof N2YOError && error.message.includes('got null')) {
        return {
          info: {
            passescount: 0,
            satid: id,
            satname: '',
            transactionscount: 0,
          },
          passes: [],
        }
      }
      throw error
    }
  }

  /**
   * Predict radio passes for a satellite (no sunlight requirement).
   *
   * @remarks Inputs are validated using Zod for type safety and API compliance.
   * @param id - NORAD catalog number (e.g., `25544` for the ISS).
   * @param observerLat - Observer latitude in decimal degrees (-90 to 90).
   * @param observerLng - Observer longitude in decimal degrees (-180 to 180).
   * @param observerAlt - Observer altitude above sea level in meters (-1000 to 10000).
   * @param days - Prediction window in days (1 to 10).
   * @param minElevation - Minimum maximum elevation in degrees to include (non-negative).
   * @returns A `Promise` resolving to a {@link RadioPassesResponse} with predicted radio passes.
   * @throws {InvalidParameterError} If inputs are invalid (e.g., `days > 10`, invalid latitude).
   * @throws {N2YOError} If the API request fails or returns null data.
   * @throws {RateLimitError} If the API rate limit is exceeded (HTTP 429).
   *
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const passes = await client.getRadioPasses(25544, 40.7128, -74.0060, 0, 7, 10);
   * console.log(passes.passes); // Array of { startAz, endAz, startUTC, ... }
   * ```
   */
  async getRadioPasses(
    id: number,
    observerLat: number,
    observerLng: number,
    observerAlt: number,
    days: number,
    minElevation: number,
  ): Promise<RadioPassesResponse> {
    try {
      GetRadioPassesParamsSchema.parse({
        id,
        observerLat,
        observerLng,
        observerAlt,
        days,
        minElevation,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error)
      }
      throw error
    }
    try {
      const response = await this.makeRequest<RadioPassesResponse>(
        `radiopasses/${id}/${observerLat}/${observerLng}/${observerAlt}/${days}/${minElevation}`,
        10 * 60 * 1000, // Cache for 10 minutes
      )
      if (!response.passes) {
        return {
          ...response,
          passes: [],
          info: { ...response.info, passescount: 0 },
        }
      }
      return response
    } catch (error) {
      if (error instanceof N2YOError && error.message.includes('got null')) {
        return {
          info: {
            passescount: 0,
            satid: id,
            satname: '',
            transactionscount: 0,
          },
          passes: [],
        }
      }
      throw error
    }
  }

  /**
   * List all catalogued objects above a given location.
   *
   * @remarks Inputs are validated using Zod for type safety and API compliance.
   * @param observerLat - Observer latitude in decimal degrees (-90 to 90).
   * @param observerLng - Observer longitude in decimal degrees (-180 to 180).
   * @param observerAlt - Observer altitude above sea level in meters (-1000 to 10000).
   * @param searchRadius - Radius around the observer to search in degrees (0 to 90).
   * @param categoryId - Satellite category to filter by (use `0` for all categories).
   * @returns A `Promise` resolving to a {@link AboveResponse} with satellites above the location.
   * @throws {InvalidParameterError} If inputs are invalid (e.g., `searchRadius` outside 0–90).
   * @throws {N2YOError} If the API request fails or returns null data.
   * @throws {RateLimitError} If the API rate limit is exceeded (HTTP 429).
   *
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const satellites = await client.getAbove(40.7128, -74.0060, 0, 90, 0);
   * console.log(satellites.above); // Array of satellites above the location
   * ```
   */
  async getAbove(
    observerLat: number,
    observerLng: number,
    observerAlt: number,
    searchRadius: number,
    categoryId: SatelliteCategoryId,
  ): Promise<AboveResponse> {
    try {
      GetAboveParamsSchema.parse({
        observerLat,
        observerLng,
        observerAlt,
        searchRadius,
        categoryId,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error)
      }
      throw error
    }
    try {
      const response = await this.makeRequest<AboveResponse>(
        `above/${observerLat}/${observerLng}/${observerAlt}/${searchRadius}/${categoryId}`,
        5 * 60 * 1000, // Cache for 5 minutes
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
   * @param categoryId - Numeric category identifier (0–56).
   * @returns Human-readable category name or `undefined` if the ID is unknown.
   *
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const category = client.getCategoryName(2); // e.g., "Amateur radio"
   * console.log(category);
   * ```
   */
  getCategoryName(
    categoryId: SatelliteCategoryId,
  ): SatelliteCategoryName | undefined {
    try {
      z.number().int().min(0).parse(categoryId)
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error)
      }
      throw error
    }
    return SatelliteCategories[categoryId]
  }

  /**
   * Convert a UTC Unix timestamp (seconds) to a local time string in the specified time zone.
   *
   * @remarks Inputs are validated using Zod for type safety.
   * @param utcTimestamp - Unix timestamp in seconds (UTC).
   * @param timeZone - IANA time zone name (e.g., 'America/New_York') or 'UTC'.
   * @returns Formatted local time string (e.g., '2025-08-01 19:17:00').
   * @throws {InvalidParameterError} If the timestamp is invalid or the time zone is not recognized.
   *
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const localTime = client.utcToLocal(1711987840, 'America/New_York');
   * console.log(localTime); // e.g., "2024-04-01 15:30:40"
   * ```
   */
  utcToLocal(utcTimestamp: number, timeZone: string): string {
    try {
      UtcToLocalParamsSchema.parse({ utcTimestamp, timeZone })
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error)
      }
      throw error
    }

    const date = new Date(utcTimestamp * 1000)

    if (timeZone.toUpperCase() === 'UTC') {
      return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`
    }

    try {
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
      this.debugLog(
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

  /**
   * Clear the cache manually.
   *
   * @remarks Clears all cached API responses.
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY', { debug: true });
   * client.clearCache(); // Clears cache and logs if debug is enabled
   * ```
   */
  clearCache(): void {
    this.cache.clear()
    if (this.config.debug) {
      this.debugLog('[N2YO] Cache cleared')
    }
  }

  /**
   * Get cache statistics.
   *
   * @returns An object with cache metrics: total entries, expired entries, valid entries, and max entries allowed.
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const stats = client.getCacheStats();
   * console.log(stats); // { total: 10, expired: 2, valid: 8, maxEntries: 100 }
   * ```
   */
  getCacheStats() {
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

  /**
   * Get rate limiting statistics.
   *
   * @returns An object with rate limit metrics: requests this hour, limit per hour, queued requests, and whether a request can be made.
   * @example
   * ```ts
   * const client = new N2YOClient('YOUR_API_KEY');
   * const stats = client.getRateLimitStats();
   * console.log(stats); // { requestsThisHour: 50, requestsPerHourLimit: 1000, queuedRequests: 0, canMakeRequest: true }
   * ```
   */
  getRateLimitStats() {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const recentRequests = this.rateLimitState.requests.filter(
      (t) => t > oneHourAgo,
    )

    return {
      requestsThisHour: recentRequests.length,
      requestsPerHourLimit: this.config.rateLimit.requestsPerHour,
      queuedRequests: this.rateLimitState.queue.length,
      canMakeRequest: this.isWithinRateLimit(),
    }
  }
}
