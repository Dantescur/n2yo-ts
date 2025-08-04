import { z } from 'zod'
import { InvalidParameterError } from './errors'
import {
  SatelliteCategories,
  type SatelliteCategoryId,
  type SatelliteCategoryName,
} from './types'

/**
 * Splits a TLE string into its two lines.
 * @param tle - The TLE string to split.
 * @returns An array of two strings representing the TLE lines.
 * @throws {InvalidParameterError} If the TLE is empty or not exactly two lines.
 */
export function splitTle(
  tle: string,
  debugLog?: (msg: string) => void,
): [string, string] {
  if (debugLog) {
    debugLog(`splitTle called with: ${tle}`)
  }
  try {
    z.string().min(1, { message: 'TLE must not be empty' }).parse(tle)
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (debugLog) {
        debugLog(`TLE validation failed: ${error.message}`)
      }
      throw new InvalidParameterError('tle', tle, error.issues[0]!.message!)
    }
    throw error
  }
  const lines = tle
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line)
  if (lines.length !== 2) {
    if (debugLog) {
      debugLog(`Invalid TLE: expected 2 lines, got ${lines.length}`)
    }
    throw new InvalidParameterError(
      'tle',
      tle,
      'TLE must have exactly two lines',
    )
  }
  if (debugLog) {
    debugLog(`TLE split into: ${JSON.stringify(lines)}`)
  }
  return [lines[0]!, lines[1]!]
}

/**
 * Converts a Unix timestamp (seconds) to a Date object.
 * @param timestamp - Unix timestamp in seconds.
 * @returns A Date object representing the timestamp.
 * @throws {InvalidParameterError} If the timestamp is NaN or infinite.
 */
export function timestampToDate(timestamp: number): Date {
  try {
    z.number().parse(timestamp)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InvalidParameterError(
        'timestamp',
        timestamp,
        'Timestamp must be a valid number',
      )
    }
    throw error
  }
  return new Date(timestamp * 1000)
}

/**
 * Returns all satellite categories.
 * @returns An array of objects with category ID and name.
 */
export function getAllCategories(): {
  id: SatelliteCategoryId
  name: SatelliteCategoryName
}[] {
  return Object.entries(SatelliteCategories).map(([id, name]) => ({
    id: Number.parseInt(id) as SatelliteCategoryId,
    name,
  }))
}

/**
 * Converts a UTC Unix timestamp (seconds) to a local time string in the specified time zone.
 * @param utcTimestamp - Unix timestamp in seconds (UTC).
 * @param timeZone - IANA time zone name (e.g., 'America/New_York') or 'UTC'.
 * @param debugLog - Debug logging function.
 * @returns Formatted local time string (e.g., '2025-08-01 19:17:00').
 * @throws {InvalidParameterError} If the timestamp or time zone is invalid.
 */
export function utcToLocal(
  utcTimestamp: number,
  timeZone: string,
  debugLog: (msg: string) => void,
): string {
  try {
    z.number().parse(utcTimestamp)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InvalidParameterError(
        'utcTimestamp',
        utcTimestamp,
        'Invalid timestamp',
      )
    }
    throw error
  }

  // Skip validation if we want to allow fallback
  const date = new Date(utcTimestamp * 1000)
  const timeZoneUpper = timeZone.toUpperCase()

  // Special handling for UTC timezone
  if (timeZoneUpper === 'UTC') {
    const year = date.getUTCFullYear().toString().padStart(4, '0')
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = date.getUTCDate().toString().padStart(2, '0')
    const hour = date.getUTCHours().toString().padStart(2, '0')
    const minute = date.getUTCMinutes().toString().padStart(2, '0')
    const second = date.getUTCSeconds().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second} UTC`
  }

  try {
    // Try to format with the given timezone
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
    debugLog(
      `Failed to format time zone '${timeZone}': ${error}. Falling back to UTC.`,
    )
    // Fall back to UTC formatting
    const year = date.getUTCFullYear().toString().padStart(4, '0')
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = date.getUTCDate().toString().padStart(2, '0')
    const hour = date.getUTCHours().toString().padStart(2, '0')
    const minute = date.getUTCMinutes().toString().padStart(2, '0')
    const second = date.getUTCSeconds().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second} UTC`
  }
}

/**
 * Returns the satellite category name for a given ID.
 * @param categoryId - Numeric category identifier (0–56).
 * @returns Human-readable category name or undefined if the ID is unknown.
 * @throws {InvalidParameterError} If categoryId is invalid.
 */
export function getCategoryName(
  categoryId: SatelliteCategoryId,
): SatelliteCategoryName | undefined {
  try {
    z.number().int().min(0).parse(categoryId)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InvalidParameterError(
        'categoryId',
        categoryId,
        'must be greater than or equal to 0',
      )
    }
    throw error
  }
  return SatelliteCategories[categoryId]
}

/**
 * Calculates the distance between two geographic points using the Haversine formula
 * @param point1 - First geographic point
 * @param point1.lat - Latitude of first point in degrees
 * @param point1.lng - Longitude of first point in degrees
 * @param point2 - Second geographic point
 * @param point2.lat - Latitude of second point in degrees
 * @param point2.lng - Longitude of second point in degrees
 * @returns Distance between points in kilometers
 * @example
 * // Calculate distance between NYC and London
 * const distance = calculateDistance(
 *   { lat: 40.7128, lng: -74.006 },  // New York City
 *   { lat: 51.5074, lng: -0.1278 }   // London
 * );
 * // Returns ~5570 km
 */
export function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number },
): number {
  // Earth's radius in kilometers
  const R = 6371

  // Convert degrees to radians
  const lat1 = (point1.lat * Math.PI) / 180
  const lng1 = (point1.lng * Math.PI) / 180
  const lat2 = (point2.lat * Math.PI) / 180
  const lng2 = (point2.lng * Math.PI) / 180

  // Differences in coordinates
  const dLat = lat2 - lat1
  const dLng = lng2 - lng1

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  // Distance in kilometers
  return R * c
}
