import { InvalidParameterError, N2YOError, RateLimitError } from './errors'
import {
  COMMON_SATELLITES,
  SatelliteCategories,
  type AboveResponse,
  type PositionsResponse,
  type RadioPassesResponse,
  type SatelliteCategoryId,
  type SatelliteCategoryName,
  type TleResponse,
  type VisualPassesResponse,
} from './types'

/**
 * N2YO API client for Node, Deno, Bun and browsers.
 *
 * @remarks
 * This class wraps the public [N2YO REST API](https://www.n2yo.com/api/)
 * and provides strongly-typed helpers for every endpoint.
 *
 * All methods return native `Promises` and automatically inject your API key,
 * handle rate-limiting (`429`) and other HTTP errors by throwing
 * {@link N2YOError}, {@link RateLimitError} or {@link InvalidParameterError}
 *
 * Common satellites can be queried by name using {@link getTleByName}
 *
 * @example
 * ```ts
 * import { N2YOClient } from 'n2yo-ts';
 *
 * const n2yo = new N2YOClient('YOUR_API_KEY');
 *
 * const iss = await n2yo.getTleByName('ISS') // Uses NORAD ID 25544
 * console.log(iss.tle);
 * ```
 */
export class N2YOClient {
  /** Base URL for all requests. */
  private readonly baseUrl: string = 'https://api.n2yo.com/rest/v1/satellite'
  /** Private API key supplied at construction. */
  private readonly apiKey: string

  /**
   * Create a new client instance.
   *
   * @param apiKey – your private N2YO API key. Must be non-empty.
   *
   * @throws {InvalidParameterError} If the key is missing or empty.
   *
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new InvalidParameterError('apiKey', apiKey, 'API key is required')
    }
    this.apiKey = apiKey
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

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}&apiKey=${this.apiKey}`
    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      throw new N2YOError(
        `Network error: Failed to connect to N2YO API. Please check your internet connection.`,
        error
      );
    }

    // First check for API key errors which come as 200 OK with error in body
    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      throw new N2YOError(
        `Invalid API response: Could not parse JSON response`,
        { cause: error }
      );
    }

    if (data && typeof data === 'object' && 'error' in data) {
      if (data.error === 'Invalid API Key!') {
        throw new InvalidParameterError(
          'apiKey',
          this.apiKey,
          'The provided N2YO API key is invalid. Please check your key and try again.'
        );
      }
      throw new N2YOError(`API error: ${data.error}`);
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new RateLimitError();
      }
      throw new N2YOError(
        `API request failed: ${response.status} ${response.statusText}`,
        { cause: data }
      );
    }

    if (data === null || typeof data !== 'object') {
      throw new N2YOError(
        `Invalid API response: Expected JSON object, got ${data === null ? 'null' : typeof data}`
      );
    }

    return data as T;
  }

  /**
   * Retrieve the latest Two-Line Element set (TLE) for a satellite.
   *
   * @param id – NORAD catalog number (e.g. `25544` for the ISS).
   * @returns Promise resolving to {@link TleResponse}.
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
   * @param id – NORAD catalog number.
   * @param observerLat – observer latitude in decimal degrees (-90 … 90).
   * @param observerLng – observer longitude in decimal degrees (-180 … 180).
   * @param observerAlt – observer altitude **above sea level** in **meters**.
   * @param seconds – how many seconds of prediction to return (max `300`).
   * @returns Promise resolving to {@link PositionsResponse}.
   *
   * @throws {@link InvalidParameterError} if `seconds > 300`.
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
}
