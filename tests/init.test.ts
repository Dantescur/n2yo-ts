import { fail } from 'node:assert'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  InvalidParameterError,
  N2YOClient,
  N2YOError,
  RateLimitError,
  type PositionsResponse,
  type TleResponse,
} from '../src/index'

describe('Integration test', () => {
  describe('N2YOClient initialization', () => {
    it('should throw InvalidParameterError for empty key', () => {
      expect(() => new N2YOClient('')).toThrow(InvalidParameterError)
    })

    it('should initialize with valid apiKey', () => {
      const client = new N2YOClient('SWD9AH-NNKRJG-K9YLFG-5JIJ')
      expect(client).toBeInstanceOf(N2YOClient)
    })

    it('should enable debug logging when configured', () => {
      const debugMock = vi.fn()
      const client = new N2YOClient('SWD9AH-NNKRJG-K9YLFG-5JIJ', {
        debug: false,
        debugLog: debugMock,
      })

      client.getTle(25544).catch(() => {})
      expect(debugMock).toHaveBeenCalled()
    })
  })

  describe('getTle integration', () => {
    let client: N2YOClient
    const mockResponse: TleResponse = {
      info: { satid: 25544, satname: 'ISS', transactionscount: 1 },
      tle: 'TLE line 1\nTLE line 2',
    }

    beforeEach(() => {
      client = new N2YOClient('test-key')
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        }),
      ) as Mock
    })

    it('should make proper API request', async () => {
      await client.getTle(25544)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.n2yo.com/rest/v1/satellite/tle/25544&apiKey=test-key',
      )
    })

    it('should return parsed TLE data', async () => {
      const result = await client.getTle(25544)
      expect(result).toEqual(mockResponse)
    })

    it('should handle API errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        }),
      ) as Mock

      await expect(client.getTle(25544)).rejects.toThrow(RateLimitError)
    })
  })

  describe('getPositions integration', () => {
    let client: N2YOClient
    const mockResponse: PositionsResponse = {
      info: { satid: 25544, satname: 'ISS', transactionscount: 1 },
      positions: [
        {
          satlatitude: 40.7128,
          satlongitude: -74.006,
          sataltitude: 400,
          azimuth: 180,
          elevation: 45,
          ra: 123.45,
          dec: 67.89,
          timestamp: Date.now() / 1000,
        },
      ],
    }

    beforeEach(() => {
      client = new N2YOClient('test-key')
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        }),
      ) as Mock
    })

    it('should validate parameters before making request', async () => {
      await expect(
        client.getPositions(
          25544,
          91, // Invalid latitude
          -74.006,
          0,
          60,
        ),
      ).rejects.toThrow(InvalidParameterError)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should handle empty positions response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ positions: null }),
        }),
      ) as Mock

      const result = await client.getPositions(25544, 40.7128, -74.006, 0, 60)
      expect(result.positions).toEqual([])
    })
  })

  describe('error handling integration', () => {
    let client: N2YOClient

    beforeEach(() => {
      client = new N2YOClient('test-key')
    })

    it('should throw InvalidParameterError for invalid NORAD ID', async () => {
      try {
        await client.getTle(-1)
        fail('Expected error to be thrown')
      } catch (error) {
        expect(error).toEqual(
          expect.objectContaining({
            name: 'InvalidParameterError',
            message: 'Invalid parameter id: -1. NORAD ID must be positive',
          }),
        )
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('should inspect the error structure', async () => {
      try {
        await client.getTle(-1)
        fail('Expected error to be thrown')
      } catch (error) {
        console.info('Error prototype chain:')
        console.info(Object.getPrototypeOf(error))
        console.info(
          'error instanceof InvalidParameterError:',
          error instanceof InvalidParameterError,
        )
        console.info('error instanceof N2YOError:', error instanceof N2YOError)
        console.info('error instanceof Error:', error instanceof Error)
      }
    })

    it('should handle 429 rate limit errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        }),
      ) as Mock

      await expect(client.getTle(25544)).rejects.toThrow(RateLimitError)
    })

    it('should wrap API errors in N2YOError', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        }),
      ) as Mock

      await expect(client.getTle(25544)).rejects.toThrow(N2YOError)
    })
  })
})
