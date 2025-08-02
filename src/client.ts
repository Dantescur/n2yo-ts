import { InvalidParameterError, N2YOError, RateLimitError } from './errors'
import {
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
 * @example
 * ```ts
 * import { N2YOClient } from 'n2yo-ts';
 *
 * const n2yo = new N2YOClient('YOUR_API_KEY');
 *
 * const iss = await n2yo.getTle(25544);
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
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429) {
        throw new RateLimitError()
      }
      throw new N2YOError(`API request failed: ${response.statusText}`)
    }

    return response.json() as Promise<T>
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
  getPositions(
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

    return this.makeRequest<PositionsResponse>(
      `positions/${id}/${observerLat}/${observerLng}/${observerAlt}/${seconds}`,
    )
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
  getVisualPasses(
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

    return this.makeRequest<VisualPassesResponse>(
      `visualpasses/${id}/${observerLat}/${observerLng}/${observerAlt}/${days}/${minVisibility}`,
    )
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
  getRadioPasses(
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

    return this.makeRequest<RadioPassesResponse>(
      `radiopasses/${id}/${observerLat}/${observerLng}/${observerAlt}/${days}/${minElevation}`,
    )
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
  getAbove(
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

    return this.makeRequest<AboveResponse>(
      `above/${observerLat}/${observerLng}/${observerAlt}/${searchRadius}/${categoryId}`,
    )
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
}
