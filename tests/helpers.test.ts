import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvalidParameterError } from '../src/errors'
import {
  calculateDistance,
  getAllCategories,
  getCategoryName,
  splitTle,
  timestampToDate,
  utcToLocal,
} from '../src/helpers'

describe('Utils', () => {
  describe('splitTle', () => {
    it('should split TLE into two lines', () => {
      const tle = 'LINE1\r\nLINE2'
      const result = splitTle(tle)
      expect(result).toEqual(['LINE1', 'LINE2'])
    })

    it('should debug errors properly')

    it('should throw for empty TLE', () => {
      expect(() => splitTle('')).toThrowError(InvalidParameterError)
      expect(() => splitTle('')).toThrowError('TLE must not be empty')
    })

    it('should throw for malformed TLE (single line)', () => {
      expect(() => splitTle('SINGLE_LINE')).toThrowError(InvalidParameterError)
      expect(() => splitTle('SINGLE_LINE')).toThrowError(
        'TLE must have exactly two lines',
      )
    })

    it('should throw for malformed TLE (too many lines)', () => {
      expect(() => splitTle('LINE1\r\nLINE2\r\nLINE3')).toThrowError(
        InvalidParameterError,
      )
      expect(() => splitTle('LINE1\r\nLINE2\r\nLINE3')).toThrowError(
        'TLE must have exactly two lines',
      )
    })

    it('should debug errors properly', () => {
      const debugLog = vi.fn()

      expect(() => splitTle('', debugLog)).toThrow()
      expect(debugLog).toHaveBeenCalledWith('splitTle called with: ')
      expect(debugLog).toHaveBeenCalledWith(
        expect.stringContaining('TLE validation failed'),
      )

      debugLog.mockClear()

      expect(() => splitTle('LINE1\nLINE2\nLINE3', debugLog)).toThrow()
      expect(debugLog).toHaveBeenCalledWith(
        'splitTle called with: LINE1\nLINE2\nLINE3',
      )
      expect(debugLog).toHaveBeenCalledWith(
        'Invalid TLE: expected 2 lines, got 3',
      )
    })

    it('should debug successful operations', () => {
      const debugLog = vi.fn()
      const tle = 'LINE1\nLINE2'
      splitTle(tle, debugLog)

      expect(debugLog).toHaveBeenCalledWith(
        'splitTle called with: LINE1\nLINE2',
      )
      expect(debugLog).toHaveBeenCalledWith('TLE split into: ["LINE1","LINE2"]')
    })
  })

  describe('timestampToDate', () => {
    const debugLog = vi.fn()
    beforeEach(() => {
      debugLog.mockClear()
    })
    it('should convert timestamp to Date', () => {
      const timestamp = 1672531200 // 2023-01-01 00:00:00 UTC
      const result = timestampToDate(timestamp)
      expect(result).toEqual(new Date('2023-01-01T00:00:00Z'))
    })

    it('should throw for NaN timestamp', () => {
      expect(() => timestampToDate(Number.NaN)).toThrowError(
        InvalidParameterError,
      )
      expect(() => timestampToDate(Number.NaN)).toThrowError(
        'Invalid parameter timestamp: NaN. Timestamp must be a valid number',
      )
    })

    it('should fall back to UTC when timezone formatting fails', () => {
      const timestamp = 1711987840
      const result = utcToLocal(timestamp, 'Invalid/Timezone', debugLog)
      expect(result).toMatch(/2024-04-01 16:10:40 UTC/)
      expect(debugLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to format time zone'),
      )
    })

    it('should throw for infinite timestamp', () => {
      expect(() => timestampToDate(Infinity)).toThrowError(
        InvalidParameterError,
      )
      expect(() => timestampToDate(Infinity)).toThrowError(
        'Timestamp must be a valid number',
      )
    })

    it('should throw for negative infinity timestamp', () => {
      expect(() => timestampToDate(-Infinity)).toThrowError(
        InvalidParameterError,
      )
      expect(() => timestampToDate(-Infinity)).toThrowError(
        'Timestamp must be a valid number',
      )
    })
  })

  describe('getAllCategories', () => {
    it('should get all categories', () => {
      const categories = getAllCategories()
      expect(categories.length).toBeGreaterThan(0)
      expect(categories[0]).toHaveProperty('id')
      expect(categories[0]).toHaveProperty('name')
    })
  })

  describe('utcToLocal', () => {
    const debugLog = vi.fn()

    beforeEach(() => {
      debugLog.mockClear()
    })

    it('should convert UTC timestamp to local time', () => {
      const timestamp = 1711987840 // 2024-04-01 19:30:40 UTC
      const result = utcToLocal(timestamp, 'America/New_York', debugLog)
      expect(result).toMatch(/2024-04-01 \d{2}:\d{2}:\d{2}/)
    })

    it('should handle UTC time zone', () => {
      const timestamp = 1711987840 // 2024-04-01 19:30:40 UTC
      const result = utcToLocal(timestamp, 'UTC', debugLog)
      expect(result).toBe('2024-04-01 16:10:40 UTC')
    })

    it('should fall back to UTC when timezone formatting fails', () => {
      const timestamp = 1711987840
      const result = utcToLocal(timestamp, 'Invalid/Timezone', debugLog)
      expect(result).toBe('2024-04-01 16:10:40 UTC')
      expect(debugLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to format time zone'),
      )
    })

    it('should throw for invalid timestamp', () => {
      expect(() =>
        utcToLocal(Number.NaN, 'America/New_York', debugLog),
      ).toThrowError(InvalidParameterError)
      expect(() =>
        utcToLocal(Number.NaN, 'America/New_York', debugLog),
      ).toThrowError('Invalid timestamp')
    })
  })

  describe('getCategoryName', () => {
    it('should get category name by ID', () => {
      const name = getCategoryName(2)
      expect(name).toBe('ISS')
    })

    it('should return undefined for unknown category ID', () => {
      /// @ts-ignore
      const name = getCategoryName(999)
      expect(name).toBeUndefined()
    })

    it('should throw for invalid category ID', () => {
      /// @ts-ignore
      expect(() => getCategoryName(-1)).toThrowError(InvalidParameterError)

      /// @ts-ignore
      expect(() => getCategoryName(-1)).toThrowError(
        'must be greater than or equal to 0',
      )
    })

    it('should handle boundary category IDs', () => {
      expect(getCategoryName(0)).toBeDefined()
      expect(getCategoryName(56)).toBeDefined()
    })

    it('should throw for non-integer category ID', () => {
      // @ts-expect-error - testing invalid input
      expect(() => getCategoryName(1.5)).toThrowError(InvalidParameterError)
    })
  })

  describe('calculateDistance', () => {
    it('should calculate distance between NYC and London', () => {
      const nyc = { lat: 40.7128, lng: -74.006 }
      const london = { lat: 51.5074, lng: -0.1278 }
      const distance = calculateDistance(nyc, london)
      expect(distance).toBeCloseTo(5570, -2) // Approximately 5570 km ± 100 km
    })

    it('should calculate distance between same point as zero', () => {
      const point = { lat: 40.7128, lng: -74.006 }
      const distance = calculateDistance(point, point)
      expect(distance).toBe(0)
    })

    it('should calculate distance between poles', () => {
      const northPole = { lat: 90, lng: 0 }
      const southPole = { lat: -90, lng: 0 }
      const distance = calculateDistance(northPole, southPole)
      expect(distance).toBeCloseTo(20015, -2) // Approximately half Earth's circumference
    })

    it('should handle anti-meridian crossing', () => {
      const point1 = { lat: 0, lng: 179 }
      const point2 = { lat: 0, lng: -179 }
      const distance = calculateDistance(point1, point2)
      expect(distance).toBeCloseTo(222, -1) // Approximately 222 km at equator
    })
  })
})
