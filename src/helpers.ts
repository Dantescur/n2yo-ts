import {
  SatelliteCategories,
  type Coordinate,
  type SatelliteCategoryId,
  type SatelliteCategoryName,
} from './types'

/**
 * Splits a Two-Line Element (TLE) string into its consituents lines.
 *
 * @param tle The TLE string containing two lines separated by CRLF (`\r\n`)
 * @returns A tuple containing the two TLE lines
 * @throws {Error} If the TLE format is invalid (not exactly two lines separated by CRLF)
 *
 * @example
 * const [ line1, line2 ] = splitTle('1 25544U...\r\n2 25544...')
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
 * Convert Unix timestamp (seconds since epoch) to a JavaScript Date object.
 * @param timestamp Unix timestamp in seconds
 * @returns Date object representing the timestamp
 * @throws {TypeError} If the timestamp is not a  valid number
 *
 * @example
 * const date = timestampToDate(17119878400) // June 2, 2024
 */
export function timestampToDate(timestamp: number): Date {
  if (Number.isNaN(timestamp) || !Number.isFinite(timestamp)) {
    throw new TypeError('Invalid timestamp value')
  }
  return new Date(timestamp * 1000)
}

/**
 * Retrieves all available satellite categories sa an array of objects
 * with both ID and name properties.
 *
 * @returns Array of categories objects in the format `{ id: number, name: string }`
 *
 * @example
 * const categories = getAllCategories()
 * // Returns [{id: 1, name: 'Brightest'}, {id: 2, name: 'ISS'},...]
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

/**
 * Calculates the great-circle distance between two points on Earth using the Haversine formula.
 *
 * @param point1 - First geographic coordinate
 * @param point2 - Second geographic coordinate
 * @returns Distance between the two points in kilometers.
 *
 * @example
 * const distance = calculateDistance(
 *   { lat: 40.7128, lng: -74.0060 }, // New York City
 *   { lat: 51.5074, lng: -0.1278 }   // London
 * ); // Returns ~5570 km
 *
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 * @see https://www.movable-type.co.uk/scripts/latlong.html
 */
export function calculateDistance(
  point1: Coordinate,
  point2: Coordinate,
): number {
  const R = 6371 // Earth's radius in kilometers
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180

  const lat1 = toRadians(point1.lat)
  const lat2 = toRadians(point2.lat)
  const deltaLat = toRadians(point2.lat - point1.lat)
  const deltaLng = toRadians(point2.lng - point1.lng)

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
