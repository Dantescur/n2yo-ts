import { N2YOClient } from './client'

// Re-export main client and all public types/utilities
export { N2YOClient } from './client'
export { InvalidParameterError, N2YOError, RateLimitError } from './errors'
export {
  COMMON_SATELLITES,
  SatelliteCategories,
  type AboveResponse,
  type Coordinate,
  type PositionsResponse,
  type RadioPassesResponse,
  type SatelliteCategoryId,
  type SatelliteCategoryName,
  type TleResponse,
  type VisualPassesResponse,
} from './types'

export {
  calculateDistance,
  getAllCategories,
  getCategoryName,
  splitTle,
  timestampToDate,
  utcToLocal,
} from './helpers'

/**
 * Factory function for creating N2YOClient instances.
 *
 * @param apiKey - Your N2YO.com API key
 * @returns A new {N2YOClient} instance
 *
 * @example
 * const client = createN2YOClient('your-api-key-here')
 */
export const createN2YOClient = (apiKey: string): N2YOClient =>
  new N2YOClient(apiKey)
