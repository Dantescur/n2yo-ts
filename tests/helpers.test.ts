import { describe, expect, it } from 'vitest'
import { InvalidParameterError } from '../src/errors'
import {
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
  })

  describe('timestampToDate', () => {
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
    const debugLog = () => {}

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

    it('should throw for invalid time zone', () => {
      expect(() =>
        utcToLocal(1711987840, 'Invalid/Timezone', debugLog),
      ).toThrowError(InvalidParameterError)
      expect(() =>
        utcToLocal(1711987840, 'Invalid/Timezone', debugLog),
      ).toThrowError('Invalid IANA time zone')
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
  })
})
