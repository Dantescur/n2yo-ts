import { N2YOClient } from './client'
export { InvalidParameterError, N2YOError, RateLimitError } from '@/errors'
export {
  SatelliteCategories,
  type AboveResponse,
  type PositionsResponse,
  type RadioPassesResponse,
  type SatelliteCategoryId,
  type SatelliteCategoryName,
  type TleResponse,
  type VisualPassesResponse,
} from '@/types'

export { getAllCategories, splitTle, timestampToDate } from '@/helpers'

// Factory function with explicit return type
export const createN2YOClient = (apiKey: string): N2YOClient =>
  new N2YOClient(apiKey)
