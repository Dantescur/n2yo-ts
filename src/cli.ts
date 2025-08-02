#!/usr/bin/env node

import process from 'node:process'
import { Command } from 'commander'
import packageJson from '../package.json'
import {
  COMMON_SATELLITES,
  createN2YOClient,
  InvalidParameterError,
  N2YOError,
  RateLimitError,
} from './index'

const program = new Command()

program
  .name('n2yo-ts')
  .description('CLI for interacting with the N2YO satellite tracking API')
  .version(packageJson.version)
  .option('--apiKey <key>', 'N2YO API key (required)')

program
  .command('tle')
  .description('Retrieve the Two-Line Element set for a satellite')
  .option('--sat <name>', 'Satellite name (e.g., ISS) or NORAD ID')
  .action(async (options) => {
    const client = initializeClient(program.opts().apiKey)
    try {
      const sat = resolveSatellite(options.sat)
      const response = await client.getTleByName(sat.name)
      console.log(
        `TLE for ${response.info.satname} (NORAD ${response.info.satid})`,
      )
      console.log(response.tle.replace('\r\n', '\n'))
    } catch (error) {
      handleError(error)
    }
  })

/**
 * Initialize N2YOClient with the provided API key.
 */
function initializeClient(apiKey: string) {
  if (!apiKey) {
    console.error('Error: --apiKey is required')
    process.exit(1)
  }
  return createN2YOClient(apiKey)
}

/**
 * Resolve satellite name or NORAD ID to a NORAD ID.
 */
function resolveSatellite(sat: string) {
  if (!sat) {
    console.error('Error: --sat is required')
    process.exit(1)
  }
  const upperSat = sat.toUpperCase()
  const noradId = COMMON_SATELLITES[upperSat] || Number.parseInt(sat)
  if (!noradId || Number.isNaN(noradId)) {
    console.error(`Error: Unknown satellite '${sat}' and not a valid NORAD ID`)
    process.exit(1)
  }
  return { id: noradId, name: COMMON_SATELLITES[upperSat] ? upperSat : sat }
}

/**
 * Validate required options.
 */
function validateOptions(options: any, required: string[]) {
  for (const opt of required) {
    if (options[opt] === undefined || options[opt] === null) {
      console.error(`Error: --${opt} is required`)
      process.exit(1)
    }
  }
}

/**
 * Handle errors gracefully.
 */
function handleError(error: any) {
  if (error instanceof RateLimitError) {
    console.error('Error: Rate limit exceeded')
  } else if (error instanceof InvalidParameterError) {
    console.error(`Error: Invalid parameter - ${error.message}`)
  } else if (error instanceof N2YOError) {
    console.error(`Error: API request failed - ${error.message}`)
  } else {
    console.error(`Error: ${error.message || error}`)
  }
  process.exit(1)
}
