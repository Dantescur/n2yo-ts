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

export class N2YOClient {
  private readonly baseUrl: string = 'https://api.n2yo.com/rest/v1/satellite'
  private readonly apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new InvalidParameterError('apiKey', apiKey, 'API key is required')
    }
    this.apiKey = apiKey
  }

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
   * Retrieve the Two Line Elements (TLE) for a satellite identified by NORAD id
   * @param id NORAD id of the satellite
   * @returns Promise with TLE data
   */
  getTle(id: number): Promise<TleResponse> {
    return this.makeRequest<TleResponse>(`tle/${id}`)
  }

  /**
   * Retrieve the future positions of any satellite as groundtrack
   * @param id NORAD id of the satellite
   * @param observerLat Observer's latitude in decimal degrees
   * @param observerLng Observer's longitude in decimal degrees
   * @param observerAlt Observer's altitude above sea level in meters
   * @param seconds Number of future positions to return (max 300)
   * @returns Promise with satellite positions data
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
   * Get predicted visual passes for any satellite relative to a location on Earth
   * @param id NORAD id of the satellite
   * @param observerLat Observer's latitude in decimal degrees
   * @param observerLng Observer's longitude in decimal degrees
   * @param observerAlt Observer's altitude above sea level in meters
   * @param days Number of days of prediction (max 10)
   * @param minVisibility Minimum number of seconds the satellite should be visible
   * @returns Promise with visual passes data
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
   * Get predicted radio passes for any satellite relative to a location on Earth
   * @param id NORAD id of the satellite
   * @param observerLat Observer's latitude in decimal degrees
   * @param observerLng Observer's longitude in decimal degrees
   * @param observerAlt Observer's altitude above sea level in meters
   * @param days Number of days of prediction (max 10)
   * @param minElevation Minimum elevation acceptable for the highest altitude point
   * @returns Promise with radio passes data
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
   * Get all objects within a given search radius above observer's location
   * @param observerLat Observer's latitude in decimal degrees
   * @param observerLng Observer's longitude in decimal degrees
   * @param observerAlt Observer's altitude above sea level in meters
   * @param searchRadius Search radius in degrees (0-90)
   * @param categoryId Category id (0 for all categories)
   * @returns Promise with satellites above data
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
   * Get the name of a satellite category by its ID
   * @param categoryId The category ID
   * @returns The category name or undefined if not found
   */
  getCategoryName(
    categoryId: SatelliteCategoryId,
  ): SatelliteCategoryName | undefined {
    return SatelliteCategories[categoryId]
  }
}
