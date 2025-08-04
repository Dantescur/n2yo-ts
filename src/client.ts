import z from 'zod'
import { Cache } from './cache'
import { InvalidParameterError, N2YOError } from './errors'
import { getCategoryName, utcToLocal } from './helpers'
import { makeRequest } from './http'
import {
  GetAboveParamsSchema,
  GetPositionsParamsSchema,
  GetRadioPassesParamsSchema,
  GetTleByNameParamsSchema,
  GetTleParamsSchema,
  GetVisualPassesParamsSchema,
  mapZodErrorToInvalidParameterError,
} from './schemas'
import {
  COMMON_SATELLITES,
  type AboveResponse,
  type N2YOClientConfig,
  type PositionsResponse,
  type RadioPassesResponse,
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
  /** Cache layer */
  private readonly cache: Cache

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
        ttlMs: 5 * 60 * 1000,
        maxEntries: 100,
        ...config.cache,
      },
      debugLog: (message: string) => {
        if (this.config.debug) console.info(`[N2YO] ${message}`)
      },
      ...config,
    }
    this.cache = new Cache(this.config)
  }

  /**
   * Retrieve the latest Two-Line Element set (TLE) for a satellite.
   * @remarks Inputs are validated using Zod for type safety. Responses are cached for 30 minutes by default.
   * @param id - NORAD catalog number (e.g., `25544` for the ISS).
   * @returns A `Promise` resolving to a {@link TleResponse} containing the satellite’s TLE data.
   * @throws {InvalidParameterError} If `id` is not a positive integer.
   * @throws {N2YOError} If the API request fails (e.g., invalid NORAD ID).
   * @throws {RateLimitError} If the API rate limit is exceeded (HTTP 429).
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
      if (this.config.debug) {
        this.config.debugLog(`Error retrieving TLE: ${error}`)
      }
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error, { id })
      }
      throw error
    }
    return makeRequest<TleResponse>(
      this.baseUrl,
      this.apiKey,
      this.config,
      this.cache,
      `tle/${id}`,
      30 * 60 * 1000,
    )
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
      if (this.config.debug) {
        this.config.debugLog(`Validated name: ${validatedName}`)
      }
    } catch (error) {
      if (this.config.debug) {
        this.config.debugLog(`Error validating at getTleByName: ${error}`)
      }
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error, { name })
      }
      throw error
    }

    const noradId = COMMON_SATELLITES[validatedName]

    if (this.config.debug) {
      this.config.debugLog(`getTleByName - noradId: ${noradId}`)
    }
    if (!noradId) {
      throw new InvalidParameterError('name', name, 'Unknown satellite name')
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
    const input = { id, observerLat, observerLng, observerAlt, seconds }
    if (this.config.debug) {
      this.config.debugLog(`getPositions called with: ${JSON.stringify(input)}`)
    }
    try {
      GetPositionsParamsSchema.parse(input)
    } catch (error) {
      if (error instanceof z.ZodError) {
        if (this.config.debug) {
          this.config.debugLog(`Validation failed: ${error.message}`)
        }
        mapZodErrorToInvalidParameterError(error, input)
      }
      throw error
    }
    try {
      const response = await makeRequest<PositionsResponse>(
        this.baseUrl,
        this.apiKey,
        this.config,
        this.cache,
        `positions/${id}/${observerLat}/${observerLng}/${observerAlt}/${seconds}`,
        2 * 60 * 1000,
      )
      if (!response.positions) {
        if (this.config.debug) {
          this.config.debugLog(
            `No positions returned for NORAD ID ${id}, returning empty array`,
          )
        }
        return { ...response, positions: [] }
      }
      return response
    } catch (error) {
      if (error instanceof N2YOError && error.message.includes('got null')) {
        if (this.config.debug) {
          this.config.debugLog(
            `Null response received, returning empty positions for NORAD ID ${id}`,
          )
        }
        return {
          info: { satcount: 0, transactionscount: 0, satid: id, satname: '' },
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
    const input = {
      id,
      observerLat,
      observerLng,
      observerAlt,
      days,
      minVisibility,
    }
    try {
      GetVisualPassesParamsSchema.parse(input)
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error, input)
      }
      throw error
    }
    try {
      const response = await makeRequest<VisualPassesResponse>(
        this.baseUrl,
        this.apiKey,
        this.config,
        this.cache,
        `visualpasses/${id}/${observerLat}/${observerLng}/${observerAlt}/${days}/${minVisibility}`,
        10 * 60 * 1000,
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
    const input = {
      id,
      observerLat,
      observerLng,
      observerAlt,
      days,
      minElevation,
    }
    try {
      GetRadioPassesParamsSchema.parse(input)
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error, input)
      }
      throw error
    }
    try {
      const response = await makeRequest<RadioPassesResponse>(
        this.baseUrl,
        this.apiKey,
        this.config,
        this.cache,
        `radiopasses/${id}/${observerLat}/${observerLng}/${observerAlt}/${days}/${minElevation}`,
        10 * 60 * 1000,
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
    const input = {
      observerLat,
      observerLng,
      observerAlt,
      searchRadius,
      categoryId,
    }
    try {
      GetAboveParamsSchema.parse(input)
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error, input)
      }
      throw error
    }
    try {
      const response = await makeRequest<AboveResponse>(
        this.baseUrl,
        this.apiKey,
        this.config,
        this.cache,
        `above/${observerLat}/${observerLng}/${observerAlt}/${searchRadius}/${categoryId}`,
        5 * 60 * 1000,
      )
      if (!response.info || !response.above) {
        return {
          info: {
            category: getCategoryName(categoryId) || 'Unknown',
            transactionscount: 0,
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
            category: getCategoryName(categoryId) || 'Unknown',
            transactionscount: 0,
            satcount: 0,
          },
          above: [],
        }
      }
      throw error
    }
  }

  utcToLocal(utcTimestamp: number, timeZone: string): string {
    return utcToLocal(utcTimestamp, timeZone, this.config.debugLog)
  }

  getCategoryName(
    categoryId: SatelliteCategoryId,
  ): SatelliteCategoryName | undefined {
    try {
      z.number().int().min(0).parse(categoryId)
    } catch (error) {
      if (error instanceof z.ZodError) {
        mapZodErrorToInvalidParameterError(error, { categoryId })
      }
      throw error
    }
    return getCategoryName(categoryId)
  }

  clearCache(): void {
    this.cache.clear()
  }

  getCacheStats() {
    return this.cache.getStats()
  }
}
