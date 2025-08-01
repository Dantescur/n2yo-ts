import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { N2YOClient } from '../src/client'
import { InvalidParameterError, RateLimitError } from '../src/errors'
import type { SatelliteCategoryId } from '../src'
import {
  mockAboveResponse,
  mockPositionsResponse,
  mockRadioPassesResponse,
  mockTleResponse,
  mockVisualPassesResponse,
} from './mock'

const TEST_API_KEY = 'test-api-key-123'
let client: N2YOClient

// Helper function to create mock responses
function createMockResponse(data: any, init?: ResponseInit): Response {
  const response = new Response(JSON.stringify(data), {
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'Content-Type': 'application/json',
      ...init?.headers,
    }),
    ...init,
  })

  // Add url property
  Object.defineProperty(response, 'url', {
    value: 'https://api.n2yo.com/mock',
    writable: true,
  })

  return response
}

beforeEach(() => {
  client = new N2YOClient(TEST_API_KEY)
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('N2YOClient', () => {
  describe('Initialization', () => {
    it('should throw when no API key is provided', () => {
      expect(() => new N2YOClient('')).toThrow(InvalidParameterError)
    })

    it('should initialize with valid API key', () => {
      expect(client).toBeInstanceOf(N2YOClient)
    })
  })

  describe('TLE Operations', () => {
    it('should fetch TLE data successfully', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(mockTleResponse))

      const result = await client.getTle(25544)

      expect(result).toEqual(mockTleResponse)
      expect(fetch).toHaveBeenCalledWith(
        `https://api.n2yo.com/rest/v1/satellite/tle/25544&apiKey=${TEST_API_KEY}`,
      )
    })

    it('should handle TLE fetch errors', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockResponse({}, { status: 500, statusText: 'Server Error' }),
      )

      await expect(client.getTle(25544)).rejects.toThrow('API request failed')
    })
  })

  describe('Position Tracking', () => {
    it('should fetch satellite positions', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockResponse(mockPositionsResponse),
      )

      const result = await client.getPositions(25544, 40, -75, 0, 10)

      expect(result).toEqual(mockPositionsResponse)
      expect(fetch).toHaveBeenCalledWith(
        `https://api.n2yo.com/rest/v1/satellite/positions/25544/40/-75/0/10&apiKey=${TEST_API_KEY}`,
      )
    })

    it('should validate positions parameters', async () => {
      await expect(
        client.getPositions(25544, 91, -181, -1, 301),
      ).rejects.toThrow(InvalidParameterError)
    })
  })

  describe('Visual Passes', () => {
    it('should fetch visual passes', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockResponse(mockVisualPassesResponse),
      )

      const result = await client.getVisualPasses(25544, 40, -75, 0, 2, 300)

      expect(result).toEqual(mockVisualPassesResponse)
    })

    it('should validate visual passes parameters', async () => {
      await expect(
        client.getVisualPasses(25544, 91, -181, -1, 11, -1),
      ).rejects.toThrow(InvalidParameterError)
    })
  })

  describe('Radio Passes', () => {
    it('should fetch radio passes', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockResponse(mockRadioPassesResponse),
      )

      const result = await client.getRadioPasses(25544, 40, -75, 0, 2, 40)

      expect(result).toEqual(mockRadioPassesResponse)
    })

    it('should validate radio passes parameters', async () => {
      await expect(
        client.getRadioPasses(25544, 91, -181, -1, 11, -1),
      ).rejects.toThrow(InvalidParameterError)
    })
  })

  describe('Satellites Above', () => {
    it('should fetch satellites above observer', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(mockAboveResponse))

      const result = await client.getAbove(40, -75, 0, 45, 18)

      expect(result).toEqual(mockAboveResponse)
    })

    it('should validate above parameters', async () => {
      await expect(
        client.getAbove(
          91,
          -181,
          -1,
          -1,
          999 as unknown as SatelliteCategoryId,
        ),
      ).rejects.toThrow(InvalidParameterError)
    })
  })

  describe('Rate Limiting', () => {
    it('should handle rate limit errors', async () => {
      vi.mocked(fetch).mockResolvedValue(
        createMockResponse(
          {},
          { status: 429, statusText: 'Too Many Requests' },
        ),
      )

      await expect(client.getTle(25544)).rejects.toThrow(RateLimitError)
    })
  })

  describe('Utility Methods', () => {
    describe('TLE Processing', () => {
      it('should split TLE into two lines', () => {
        const tle = 'LINE1\r\nLINE2'
        const result = N2YOClient.splitTle(tle)
        expect(result).toEqual(['LINE1', 'LINE2'])
      })

      it('should throw for empty TLE', () => {
        expect(() => N2YOClient.splitTle('')).toThrow('Invalid TLE format')
      })

      it('should throw for malformed TLE (single line)', () => {
        expect(() => N2YOClient.splitTle('SINGLE_LINE')).toThrow(
          'Invalid TLE format',
        )
      })

      it('should throw for malformed TLE (too many lines)', () => {
        expect(() => N2YOClient.splitTle('LINE1\r\nLINE2\r\nLINE3')).toThrow(
          'Invalid TLE format',
        )
      })
    })

    describe('Time Conversion', () => {
      it('should convert timestamp to Date', () => {
        const timestamp = 1672531200 // 2023-01-01 00:00:00 UTC
        const result = N2YOClient.timestampToDate(timestamp)
        expect(result).toEqual(new Date('2023-01-01T00:00:00Z'))
      })

      it('should throw for NaN timestamp', () => {
        expect(() => N2YOClient.timestampToDate(Number.NaN)).toThrow(
          'Invalid timestamp value',
        )
      })

      it('should throw for infinite timestamp', () => {
        expect(() => N2YOClient.timestampToDate(Infinity)).toThrow(
          'Invalid timestamp value',
        )
      })

      it('should throw for negative infinity timestamp', () => {
        expect(() => N2YOClient.timestampToDate(-Infinity)).toThrow(
          'Invalid timestamp value',
        )
      })
    })

    describe('Category Lookup', () => {
      it('should get category name by ID', () => {
        expect(client.getCategoryName(18)).toBe('Amateur radio')
        expect(
          client.getCategoryName(999 as unknown as SatelliteCategoryId),
        ).toBeUndefined()
      })

      it('should get all categories', () => {
        const categories = N2YOClient.getAllCategories()
        expect(categories.length).toBeGreaterThan(0)
        expect(categories[0]).toHaveProperty('id')
        expect(categories[0]).toHaveProperty('name')
      })
    })
  })
})
