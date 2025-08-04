import { beforeEach, describe, expect, it, vi } from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import { N2YOClient } from '../src/client'
import { InvalidParameterError, N2YOError } from '../src/errors'
import type {
  AboveResponse,
  PositionsResponse,
  RadioPassesResponse,
  TleResponse,
  VisualPassesResponse,
} from '../src/types'

const fetchMocker = createFetchMock(vi)

describe('N2YOClient', () => {
  let client: N2YOClient

  beforeEach(() => {
    fetchMocker.enableMocks()
    client = new N2YOClient('TEST_API_KEY', { debug: true })
  })

  describe('Initialization', () => {
    it('should throw when no API key is provided', () => {
      expect(() => new N2YOClient('')).toThrowError(InvalidParameterError)
      expect(() => new N2YOClient('')).toThrowError('API key is required')
    })

    it('should initialize with valid API key', () => {
      expect(() => new N2YOClient('TEST_API_KEY')).not.toThrow()
    })
  })

  describe('TLE Operations', () => {
    it('should fetch TLE data successfully', async () => {
      const mockResponse: TleResponse = {
        info: { satid: 25544, satname: 'ISS', transactionscount: 0 },
        tle: 'LINE1\nLINE2',
      }
      fetchMocker.mockResponseOnce(JSON.stringify(mockResponse))
      const result = await client.getTle(25544)
      expect(result).toEqual(mockResponse)
      expect(fetchMocker).toHaveBeenCalledWith(
        'https://api.n2yo.com/rest/v1/satellite/tle/25544&apiKey=TEST_API_KEY',
      )
    })

    it('should throw InvalidParameterError for invalid NORAD ID', async () => {
      await expect(client.getTle(25544)).rejects.toThrow(
        'Invalid parameter id: -1. NORAD ID must be positive',
      )
    })

    it('should fetch TLE by name', async () => {
      const mockResponse: TleResponse = {
        info: { satid: 25544, satname: 'ISS', transactionscount: 0 },
        tle: 'LINE1\nLINE2',
      }
      fetchMocker.mockResponseOnce(JSON.stringify(mockResponse))
      const result = await client.getTleByName('ISS')
      expect(result).toEqual(mockResponse)
      expect(fetchMocker).toHaveBeenCalledWith(
        'https://api.n2yo.com/rest/v1/satellite/tle/25544&apiKey=TEST_API_KEY',
      )
    })

    // it('should throw for unknown satellite name', async () => {
    //   await expect(client.getTleByName('UNKNOWN')).rejects.toThrow(
    //     new InvalidParameterError('name', 'UNKNOWN', 'Unknown satellite name'),
    //   )
    // })

    it('should handle API errors properly', async () => {
      fetchMocker.mockResponseOnce(
        JSON.stringify({ error: 'Invalid API Key!' }),
        { status: 403 },
      )

      await expect(client.getTle(25544)).rejects.toThrow(N2YOError)
      await expect(client.getTle(25544)).rejects.toThrow('Invalid API Key!')
    })
  })

  describe('Position Tracking', () => {
    it('should fetch satellite positions', async () => {
      const mockResponse: PositionsResponse = {
        info: { satid: 25544, satname: 'ISS', transactionscount: 1 },
        positions: [
          {
            satlatitude: 0,
            satlongitude: 0,
            timestamp: 0,
            azimuth: 20,
            dec: 5,
            elevation: 35,
            ra: 5,
            sataltitude: 50,
          },
        ],
      }
      fetchMocker.mockResponseOnce(JSON.stringify(mockResponse))
      const result = await client.getPositions(25544, 40.7128, -74.006, 0, 60)
      expect(result).toEqual(mockResponse)
      const url = `https://api.n2yo.com/rest/v1/satellite/positions/25544/40.7128/-74.006/0/60&apiKey=TEST_API_KEY`
      expect(fetchMocker).toHaveBeenCalledWith(url)
    })

    it('should validate positions parameters', async () => {
      await expect(
        client.getPositions(-1, 40.7128, -74.006, 0, 60),
      ).rejects.toThrowError('NORAD ID must be positive')
      await expect(
        client.getPositions(25544, 91, -74.006, 0, 60),
      ).rejects.toThrowError('Latitude must be between -90 and 90 degrees')
      await expect(
        client.getPositions(25544, 40.7128, -74.006, 0, 301),
      ).rejects.toThrowError('Seconds must be between 1 and 300')
    })

    it('should handle null positions response', async () => {
      fetchMocker.mockResponseOnce(
        JSON.stringify({ info: { satid: 25544, satname: 'ISS' } }),
      )
      const result = await client.getPositions(25544, 40.7128, -74.006, 0, 60)
      expect(result).toEqual({
        info: { satid: 25544, satname: 'ISS' },
        positions: [],
      })
    })
  })

  describe('Visual Passes', () => {
    it('should fetch visual passes', async () => {
      const mockResponse: VisualPassesResponse = {
        info: {
          satid: 25544,
          satname: 'ISS',
          passescount: 1,
          transactionscount: 4,
        },
        passes: [
          {
            startAz: 0,
            endAz: 0,
            startUTC: 0,
            startAzCompass: 'west',
            endAzCompass: 'north',
            endUTC: Date.now(),
            maxAz: 170,
            maxAzCompass: 'south',
            maxEl: 56,
            maxUTC: Date.now(),
          },
        ],
      }
      fetchMocker.mockResponseOnce(JSON.stringify(mockResponse))
      const result = await client.getVisualPasses(
        25544,
        40.7128,
        -74.006,
        0,
        7,
        30,
      )
      expect(result).toEqual(mockResponse)
    })

    it('should validate visual passes parameters', async () => {
      await expect(
        client.getVisualPasses(25544, 40.7128, -74.006, 0, 11, 30),
      ).rejects.toThrowError('Days must be between 1 and 10')
      await expect(
        client.getVisualPasses(25544, 40.7128, -74.006, 0, 7, -1),
      ).rejects.toThrowError('Minimum visibility must be positive')
    })
  })

  describe('Radio Passes', () => {
    it('should fetch radio passes', async () => {
      const mockResponse: RadioPassesResponse = {
        info: {
          satid: 25544,
          satname: 'ISS',
          passescount: 1,
          transactionscount: 3,
        },
        passes: [
          {
            startAz: 0,
            endAz: 0,
            startUTC: 0,
            startAzCompass: 'west',
            endAzCompass: 'north',
            endUTC: Date.now(),
            maxAz: 170,
            maxAzCompass: 'south',
            maxEl: 56,
            maxUTC: Date.now(),
          },
        ],
      }
      fetchMocker.mockResponseOnce(JSON.stringify(mockResponse))
      const result = await client.getRadioPasses(
        25544,
        40.7128,
        -74.006,
        0,
        7,
        10,
      )
      expect(result).toEqual(mockResponse)
    })

    it('should validate radio passes parameters', async () => {
      await expect(
        client.getRadioPasses(25544, 40.7128, -74.006, 0, 11, 10),
      ).rejects.toThrowError('Days must be between 1 and 10')
      await expect(
        client.getRadioPasses(25544, 40.7128, -74.006, 0, 7, -1),
      ).rejects.toThrowError('Minimum elevation must be non-negative')
    })
  })

  describe('Satellites Above', () => {
    it('should fetch satellites above observer', async () => {
      const mockResponse: AboveResponse = {
        info: { category: 'All', satcount: 1, transactionscount: 1 },
        above: [
          {
            satid: 25544,
            satname: 'ISS',
            intDesignator: '23425',
            launchDate: '11/16/2024',
            satalt: 23,
            satlat: 12,
            satlng: 34,
          },
        ],
      }
      fetchMocker.mockResponseOnce(JSON.stringify(mockResponse))
      const result = await client.getAbove(40.7128, -74.006, 0, 90, 0)
      expect(result).toEqual(mockResponse)
    })

    it('should validate above parameters', async () => {
      await expect(
        client.getAbove(40.7128, -74.006, 0, 91, 0),
      ).rejects.toThrowError('Search radius must be between 0 and 90 degrees')
      await expect(
        client.getAbove(40.7128, -74.006, 11000, 90, 0),
      ).rejects.toThrowError('Altitude must be between -1000 and 10000 meters')
    })
  })

  describe('Cache', () => {
    it('should cache responses', async () => {
      // Create a fresh client just for this test
      const testClient = new N2YOClient('TEST_API_KEY', { debug: false })
      const mockResponse: TleResponse = {
        info: { satid: 25544, satname: 'ISS', transactionscount: 7 },
        tle: 'LINE1\nLINE2',
      }

      // Reset fetch mocks and mock only once
      fetchMocker.resetMocks()
      fetchMocker.mockResponseOnce(JSON.stringify(mockResponse))

      // First call - should call API
      const result1 = await testClient.getTle(25544)
      expect(result1).toEqual(mockResponse)

      // Second call - should use cache
      const result2 = await testClient.getTle(25544)
      expect(result2).toEqual(mockResponse)

      // Should only call API once
      expect(fetchMocker).toHaveBeenCalledTimes(1)
    })
  })
})
