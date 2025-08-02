import {
  SatelliteCategories,
  type SatelliteCategoryId,
  type SatelliteCategoryName,
} from '@/types'

/**
 * Split the TLE string into its two lines
 * @param tle The single-line TLE string
 * @returns Array with the two TLE lines
 */
export function splitTle(tle: string): [string, string] {
  if (!tle.includes('\r\n')) {
    throw new Error(
      String.raw`Invalid TLE format - must contain two lines separated by \r\n`,
    )
  }
  const lines = tle.split('\r\n')
  if (lines.length !== 2) {
    throw new Error('Invalid TLE format - must contain exactly two lines')
  }
  return lines as [string, string]
}

/**
 * Convert Unix timestamp to Date object
 * @param timestamp Unix timestamp in seconds
 * @returns Date object
 */
export function timestampToDate(timestamp: number): Date {
  if (Number.isNaN(timestamp) || !Number.isFinite(timestamp)) {
    throw new TypeError('Invalid timestamp value')
  }
  return new Date(timestamp * 1000)
}

/**
 * Get all satellite categories as an array of {id, name} objects
 * @returns Array of all satellite categories
 */
export function getAllCategories(): Array<{
  id: SatelliteCategoryId
  name: SatelliteCategoryName
}> {
  return Object.entries(SatelliteCategories).map(([id, name]) => ({
    id: Number.parseInt(id) as SatelliteCategoryId,
    name,
  }))
}
