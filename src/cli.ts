#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Command, Option } from '@commander-js/extra-typings'
import prompts from 'prompts'
import packageJson from '../package.json'
import {
  calculateDistance,
  COMMON_SATELLITES,
  createN2YOClient,
  InvalidParameterError,
  N2YOError,
  RateLimitError,
  type SatelliteCategoryId,
} from './index'

// Define shared option interfaces
interface SatOption {
  sat: string
}
interface LocationOptions {
  lat: number
  lng: number
  alt: number
}
interface TimeOptions {
  days: number
  tz: string
}

// Shared validators
const validate = {
  number: (value: string, min?: number, max?: number): number => {
    const n = Number(value)
    if (Number.isNaN(n)) throw new Error(`must be a number, got '${value}'`)
    if (min != null && n < min) throw new Error(`must be ≥ ${min}`)
    if (max != null && n > max) throw new Error(`must be ≤ ${max}`)
    return n
  },
  latitude: (value: string) => validate.number(value, -90, 90),
  longitude: (value: string) => validate.number(value, -180, 180),
  altitude: (value: string) => validate.number(value, 0),
  days: (value: string) => validate.number(value, 1, 10),
  seconds: (value: string) => validate.number(value, 0, 300),
  visibility: (value: string) => validate.number(value, 0),
  elevation: (value: string) => validate.number(value, 0),
  radius: (value: string) => validate.number(value, 0, 90),
  category: (value: string): SatelliteCategoryId => {
    const n = Number.parseInt(value)
    if (Number.isNaN(n)) throw new Error(`must be a number, got ${value}`)
    if (n < 0 || n > 56) throw new Error('must be between 0 and 56')
    return String(n) as SatelliteCategoryId
  },
}

// Debug helper
const debug = (...args: any[]) =>
  program.opts().verbose &&
  console.error(`[${new Date().toISOString()}] DEBUG:`, ...args)

// Shared option definitions
const opts = {
  sat: new Option(
    '--sat <name>',
    'Satellite name (e.g., ISS) or NORAD ID',
  ).makeOptionMandatory(),
  lat: new Option('--lat <latitude>', 'Observer latitude (-90 to 90)')
    .argParser(validate.latitude)
    .makeOptionMandatory(),
  lng: new Option('--lng <longitude>', 'Observer longitude (-180 to 180)')
    .argParser(validate.longitude)
    .makeOptionMandatory(),
  alt: new Option('--alt <altitude>', 'Observer altitude in meters')
    .argParser(validate.altitude)
    .default(0),
  days: new Option('--days <days>', 'Prediction window in days (1-10)')
    .argParser(validate.days)
    .default(1),
  tz: new Option(
    '--tz <timezone>',
    'Time zone for output (e.g., America/New_York)',
  ).default('UTC'),
}

// Initialize client
const getClient = async (apiKey?: string) => {
  if (apiKey) {
    debug('Using API key from command-line options')
    return createN2YOClient(apiKey)
  }
  const envApiKey = process.env.N2YO_API_KEY
  if (envApiKey) {
    debug('Using API key from N2YO_API_KEY environment variable')
    return createN2YOClient(envApiKey)
  }

  const configPath = join(homedir(), '.n2yo-ts', 'config.json')
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      if (config.apiKey) {
        debug('Using API key from config file: ', configPath)
        return createN2YOClient(config.apiKey)
      }
    } catch (error) {
      console.warn(`Failed to read or parse config file ${configPath}:`, error)
    }
  }

  const response = await prompts({
    type: 'password',
    name: 'apiKey',
    message: 'Enter your N2YO API key:',
    validate: (value: string) => (value ? true : 'API key is required'),
  })

  if (!response.apiKey) {
    program.error('API key required')
  }

  debug('Using API key from user prompt')
  return createN2YOClient(response.apiKey)
}

// Resolve satellite
const resolveSatellite = (sat: string) => {
  if (!sat) program.error('Satellite name or NORAD ID required')
  const upperSat = sat.toUpperCase()
  const noradId = COMMON_SATELLITES[upperSat] || Number.parseInt(sat)
  if (!noradId || Number.isNaN(noradId))
    program.error(`Unknown satellite '${sat}' or invalid NORAD ID`)
  return { id: noradId, name: COMMON_SATELLITES[upperSat] ? upperSat : sat }
}

// Handle errors
const handleError = (error: unknown) => {
  if (error instanceof RateLimitError) program.error('Rate limit exceeded')
  if (error instanceof InvalidParameterError)
    program.error(`Invalid parameter: ${error.message}`)
  if (error instanceof N2YOError)
    program.error(`API request failed: ${error.message}`)
  program.error(error instanceof Error ? error.message : String(error))
}

const program = new Command()
  .name('n2yo-ts')
  .description('CLI for N2YO satellite tracking API')
  .version(packageJson.version)
  .option('--apiKey <key>', 'N2YO API key')
  .option('-v, --verbose', 'Enable verbose output', false)

// Commands
program
  .command('tle')
  .description('Retrieve TLE for a satellite')
  .addOption(opts.sat)
  .action(async (options: SatOption) => {
    const client = await getClient(program.opts().apiKey)
    try {
      const { name } = resolveSatellite(options.sat)
      debug('TLE', { sat: options.sat })
      const {
        info: { satname, satid },
        tle,
      } = await client.getTleByName(name)
      console.log(`TLE for ${satname} (NORAD ${satid})`)
      console.log(tle.replace('\r\n', '\n'))
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('positions')
  .description('Predict future satellite positions')
  .addOption(opts.sat)
  .addOption(opts.lat)
  .addOption(opts.lng)
  .addOption(opts.alt)
  .addOption(
    new Option('--seconds <seconds>', 'Seconds of prediction (0-300)')
      .argParser(validate.seconds)
      .default(60),
  )
  .action(
    async (options: SatOption & LocationOptions & { seconds: number }) => {
      const client = await getClient(program.opts().apiKey)
      try {
        const { id } = resolveSatellite(options.sat)
        debug('Positions', options)
        const {
          info: { satname, satid },
          positions,
        } = await client.getPositions(
          id,
          options.lat,
          options.lng,
          options.alt,
          options.seconds,
        )
        if (!positions.length) {
          console.log('No positions returned for the specified parameters.')
          return
        }
        console.log(`Positions for ${satname} (NORAD ${satid}):`)
        positions.forEach(
          ({ satlatitude, satlongitude, sataltitude, timestamp }) => {
            const distance = calculateDistance(
              { lat: options.lat, lng: options.lng },
              { lat: satlatitude, lng: satlongitude },
            )
            console.log(
              `Time: ${client.utcToLocal(timestamp, 'UTC')}, ` +
                `Lat: ${satlatitude.toFixed(2)}, Lng: ${satlongitude.toFixed(2)}, ` +
                `Alt: ${sataltitude.toFixed(2)} km, Distance: ${distance.toFixed(2)} km`,
            )
          },
        )
      } catch (error) {
        handleError(error)
      }
    },
  )

program
  .command('visualpasses')
  .description('Predict visual passes for a satellite')
  .addOption(opts.sat)
  .addOption(opts.lat)
  .addOption(opts.lng)
  .addOption(opts.alt)
  .addOption(opts.days)
  .addOption(
    new Option('--min-visibility <seconds>', 'Minimum pass duration in seconds')
      .argParser(validate.visibility)
      .default(300),
  )
  .addOption(opts.tz)
  .action(
    async (
      options: SatOption &
        LocationOptions &
        TimeOptions & { minVisibility: number },
    ) => {
      const client = await getClient(program.opts().apiKey)
      try {
        const { id } = resolveSatellite(options.sat)
        debug('Visual Passes', options)
        const {
          info: { satname, satid },
          passes,
        } = await client.getVisualPasses(
          id,
          options.lat,
          options.lng,
          options.alt,
          options.days,
          options.minVisibility,
        )
        console.log(`Visual passes for ${satname} (NORAD ${satid}):`)
        if (!passes.length) {
          console.log('No visual passes found for the specified parameters.')
          return
        }
        passes.forEach(({ startUTC, endUTC, duration, maxEl, mag }) => {
          console.log(
            `Start: ${client.utcToLocal(startUTC, options.tz)} ${options.tz}, ` +
              `End: ${client.utcToLocal(endUTC, options.tz)}, ` +
              `Duration: ${duration}s, Max Elevation: ${maxEl}°, Magnitude: ${mag || 'N/A'}`,
          )
        })
      } catch (error) {
        handleError(error)
      }
    },
  )

program
  .command('radiopasses')
  .description('Predict radio passes for a satellite')
  .addOption(opts.sat)
  .addOption(opts.lat)
  .addOption(opts.lng)
  .addOption(opts.alt)
  .addOption(opts.days)
  .addOption(
    new Option('--min-elevation <degrees>', 'Minimum max elevation in degrees')
      .argParser(validate.elevation)
      .default(0),
  )
  .addOption(opts.tz)
  .action(
    async (
      options: SatOption &
        LocationOptions &
        TimeOptions & { minElevation: number },
    ) => {
      const client = await getClient(program.opts().apiKey)
      try {
        const { id } = resolveSatellite(options.sat)
        debug('Radio Passes', options)
        const {
          info: { satname, satid },
          passes,
        } = await client.getRadioPasses(
          id,
          options.lat,
          options.lng,
          options.alt,
          options.days,
          options.minElevation,
        )
        console.log(`Radio passes for ${satname} (NORAD ${satid}):`)
        if (!passes.length) {
          console.log('No radio passes found for the specified parameters.')
          return
        }
        passes.forEach(({ startUTC, endUTC, maxEl }) => {
          console.log(
            `Start: ${client.utcToLocal(startUTC, options.tz)} ${options.tz}, ` +
              `End: ${client.utcToLocal(endUTC, options.tz)}, Max Elevation: ${maxEl}°`,
          )
        })
      } catch (error) {
        handleError(error)
      }
    },
  )

program
  .command('above')
  .description('List satellites above a location')
  .addOption(opts.lat)
  .addOption(opts.lng)
  .addOption(opts.alt)
  .addOption(
    new Option('--radius <degrees>', 'Search radius (0-90)')
      .argParser(validate.radius)
      .default(90),
  )
  .addOption(
    new Option('--category <id>', 'Satellite category ID (0 for all)')
      .argParser(validate.category)
      .default('1' as SatelliteCategoryId),
  )
  .action(
    async (
      options: LocationOptions & {
        radius: number
        category: SatelliteCategoryId
      },
    ) => {
      const client = await getClient(program.opts().apiKey)
      try {
        debug('Above', options)
        const {
          info: { category: cat },
          above,
        } = await client.getAbove(
          options.lat,
          options.lng,
          options.alt,
          options.radius,
          options.category,
        )
        console.log(`Satellites above (Category: ${cat || 'All'}):`)
        if (!above.length) {
          console.log('No satellites found above the specified location.')
          return
        }
        above.forEach(({ satname, satid, satlat, satlng, satalt }) => {
          const distance = calculateDistance(
            { lat: options.lat, lng: options.lng },
            { lat: satlat, lng: satlng },
          )
          console.log(
            `${satname} (NORAD ${satid}): ` +
              `Lat: ${satlat.toFixed(2)}, Lng: ${satlng.toFixed(2)}, ` +
              `Alt: ${satalt.toFixed(2)} km, Distance: ${distance.toFixed(2)} km`,
          )
        })
      } catch (error) {
        handleError(error)
      }
    },
  )

program.parseAsync()
