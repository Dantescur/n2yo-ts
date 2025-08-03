# N2YO TypeScript Client [![npm version](https://img.shields.io/npm/v/n2yo-ts.svg)](https://www.npmjs.com/package/n2yo-ts) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A strongly-typed, feature-complete TypeScript client for the
[N2YO.com](https://www.n2yo.com/) satellite tracking API with comprehensive
type safety and developer experience.

## Features ✨

- **Full API Coverage**: All N2YO API endpoints with proper TypeScript typings
- **Type Safety**: Strict TypeScript types for all requests and responses
- **Error Handling**: Custom error classes for different failure scenarios
- **Utility Functions**: Helpers for working with TLE data and timestamps
- **Well Documented**: Comprehensive JSDoc comments and examples
- **Modern JS/TS**: ES Modules, async/await, and modern TypeScript features

## Installation 📦

```bash
# npm
npm install n2yo-ts

# yarn
yarn add n2yo-ts

# pnpm
pnpm add n2yo-ts
```

## Getting Started 🚀

First, obtain your API key from [N2YO.com](https://www.n2yo.com/api/).

### Basic Usage Example

```typescript
import { createN2YOClient } from 'n2yo-ts'

// Initialize client with your API key
const client = createN2YOClient('YOUR_API_KEY')

// Track the International Space Station (NORAD ID 25544)
async function trackISS() {
  try {
    // Get current position
    const positions = await client.getPositions(25544, 40.7128, -74.006, 0, 60)

    // Get next visible passes over New York
    const passes = await client.getVisualPasses(
      25544,
      40.7128,
      -74.006,
      0,
      7,
      300,
    )

    console.log('Current ISS Position:', positions[0])
    console.log('Next Visible Passes:', passes)
  } catch (error) {
    console.error('Tracking error:', error)
  }
}

trackISS()
```

## API Reference 📚

### Client Methods

#### `getTle(noradId: number)`

Retrieve Two-Line Element (TLE) data for a satellite.

```typescript
const tle = await client.getTle(25544) // ISS
```

#### `getPositions(noradId: number, latitude: number, longitude: number, altitude: number, seconds: number)`

Get satellite positions over time.

```typescript
// Get ISS positions for next 5 minutes over London
const positions = await client.getPositions(25544, 51.5074, -0.1278, 0, 300)
```

#### `getVisualPasses(noradId: number, latitude: number, longitude: number, altitude: number, days: number, minVisibility: number)`

Predict visible satellite passes.

```typescript
// Get visible ISS passes over Tokyo in next 3 days (minimum 5 minutes visibility)
const passes = await client.getVisualPasses(25544, 35.6762, 139.6503, 0, 3, 300)
```

#### `getRadioPasses(noradId: number, latitude: number, longitude: number, altitude: number, days: number, minElevation: number)`

Predict radio-visible satellite passes.

```typescript
// Get radio passes for amateur radio satellite over Berlin
const passes = await client.getRadioPasses(42784, 52.52, 13.405, 0, 7, 30)
```

#### `getAbove(latitude: number, longitude: number, altitude: number, searchRadius: number, categoryId?: number)`

Find satellites currently overhead.

```typescript
// Find all Starlink satellites above a 90-degree radius
const starlinks = await client.getAbove(34.0522, -118.2437, 0, 90, 52)
```

### Utility Functions

```typescript
import {
  calculateDistance,
  getAllCategories,
  splitTle,
  timestampToDate,
} from 'n2yo-ts'

// Split TLE into separate lines
const [line1, line2] = splitTle('1 25544U...\r\n2 25544...')

// Convert UNIX timestamp to Date object
const passTime = timestampToDate(1719878400)

// Get all satellite categories
const categories = getAllCategories()

const distance = calculateDistance(
  { lat: 40.7128, lng: -74.006 }, // New York City
  { lat: 51.5074, lng: -0.1278 }, // London
)
// Returns ~5570 km
```

## Error Handling ⚠️

The library provides specific error classes:

| Error Class             | Description                                 |
| ----------------------- | ------------------------------------------- |
| `N2YOError`             | Base error class for all N2YO errors        |
| `RateLimitError`        | Thrown when API rate limit is exceeded      |
| `InvalidParameterError` | Thrown when invalid parameters are provided |

```typescript
try {
  await client.getPositions(25544, 91, 0, 0, 60) // Invalid latitude
} catch (error) {
  if (error instanceof InvalidParameterError) {
    console.error('Invalid parameter:', error.message)
  } else if (error instanceof RateLimitError) {
    console.error('Slow down! You hit the rate limit')
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## Rate Limits ⏱️

N2YO enforces the following rate limits:

| Endpoint      | Limit               |
| ------------- | ------------------- |
| Positions     | 1,000 requests/hour |
| Visual Passes | 100 requests/hour   |
| Radio Passes  | 100 requests/hour   |
| Above         | 100 requests/hour   |

The client doesn't implement rate limiting internally - you should implement
your own throttling.

## Advanced Usage 🧠

### TypeScript Types

All API response types are exported for your convenience:

```typescript
import type { PositionsResponse, SatellitePass, TleResponse } from 'n2yo-ts'

function logPassDetails(pass: SatellitePass) {
  console.log(`Pass starts at ${new Date(pass.startUTC * 1000)}`)
}
```

### Satellite Categories

The complete list of satellite categories is available:

```typescript
import { SatelliteCategories } from 'n2yo-ts'

console.log(SatelliteCategories[18]) // "Amateur radio"
```

## Command-Line Interface (CLI) 🖥️

The `n2yo-ts` package includes a powerful CLI for interacting with the N2YO
API directly from your terminal. Install it globally to use the `n2yo-ts` command:

```bash
# Install globally with npm
npm install n2yo-ts -g

# Or with pnpm
pnpm install n2yo-ts -g

# Or with yarn
yarn global add n2yo-ts
```

### CLI Usage

Run `n2yo-ts --help` to see all available commands and options. The CLI requires an `--apiKey` option for all commands, which you can obtain from [N2YO.com](https://www.n2yo.com/api/).

```bash
n2yo-ts <command> --apiKey <your-api-key> [options]
```

**Global Options**:

- `--apiKey <key>`: Your N2YO API key (required).
- `-v, --verbose`: Enable verbose output for debugging (optional).

### Commands

#### `tle --sat <name|noradId>`

Retrieve the Two-Line Element (TLE) data for a satellite by its common name (e.g., `ISS`, `HUBBLE`) or NORAD ID.

```bash
n2yo-ts tle --sat ISS --apiKey <key>
```

**Output**:

```
TLE for ISS (ZARYA) (NORAD 25544)
1 25544U 98067A   24245.12345678  .00002134  00000-0  45678-4 0  9999
2 25544  51.6456 123.4567 0001234 123.4567 234.5678 15.12345678901234
```

#### `positions --sat <name|noradId> --lat <latitude> --lng <longitude> [--alt <altitude>] [--seconds <seconds>]`

Predict satellite positions for the specified location and time window.

- `--sat <name|noradId>`: Satellite name (e.g., `ISS`) or NORAD ID (required).
- `--lat <latitude>`: Observer latitude (-90 to 90 degrees, required).
- `--lng <longitude>`: Observer longitude (-180 to 180 degrees, required).
- `--alt <altitude>`: Observer altitude in meters (default: 0).
- `--seconds <seconds>`: Seconds of prediction (0–300, default: 60).

```bash
n2yo-ts positions --sat ISS --lat 40.7128 --lng -74.006 --alt 0 --seconds 60 --apiKey <key>
```

**Output**:

```
Positions for ISS (ZARYA) (NORAD 25544):
Time: 2025-08-01 23:17:00 UTC, Lat: 40.12, Lng: -73.45, Alt: 420.34 km, Distance: 557.23 km
Time: 2025-08-01 23:17:01 UTC, Lat: 40.13, Lng: -73.44, Alt: 420.35 km, Distance: 556.89 km
...
```

#### `visualpasses --sat <name|noradId> --lat <latitude> --lng <longitude> [--alt <altitude>] [--days <days>] [--min-visibility <seconds>] [--tz <timezone>]`

Predict visible (sunlit) satellite passes for the specified location.

- `--sat <name|noradId>`: Satellite name or NORAD ID (required).
- `--lat <latitude>`: Observer latitude (-90 to 90 degrees, required).
- `--lng <longitude>`: Observer longitude (-180 to 180 degrees, required).
- `--alt <altitude>`: Observer altitude in meters (default: 0).
- `--days <days>`: Prediction window in days (1–10, default: 1).
- `--min-visibility <seconds>`: Minimum pass duration in seconds (default: 300).
- `--tz <timezone>`: Time zone for output (e.g., `America/New_York`, default: `UTC`).

```bash
n2yo-ts visualpasses --sat ISS --lat 35.6762 --lng 139.6503 --days 3 --min-visibility 300 --tz Asia/Tokyo --apiKey <key>
```

**Output**:

```
Visual passes for ISS (ZARYA) (NORAD 25544):
Start: 2025-08-02 20:15:30 Asia/Tokyo, End: 2025-08-02 20:21:45, Duration: 375s, Max Elevation: 45°, Magnitude: -2.5
...
```

#### `radiopasses --sat <name|noradId> --lat <latitude> --lng <longitude> [--alt <altitude>] [--days <days>] [--min-elevation <degrees>] [--tz <timezone>]`

Predict radio passes (no sunlight requirement) for the specified location.

- `--sat <name|noradId>`: Satellite name or NORAD ID (required).
- `--lat <latitude>`: Observer latitude (-90 to 90 degrees, required).
- `--lng <longitude>`: Observer longitude (-180 to 180 degrees, required).
- `--alt <altitude>`: Observer altitude in meters (default: 0).
- `--days <days>`: Prediction window in days (1–10, default: 1).
- `--min-elevation <degrees>`: Minimum max elevation in degrees (default: 0).
- `--tz <timezone>`: Time zone for output (e.g., `America/New_York`, default: `UTC`).

```bash
n2yo-ts radiopasses --sat 42784 --lat 52.52 --lng 13.405 --days 7 --min-elevation 30 --tz Europe/Berlin --apiKey <key>
```

**Output**:

```
Radio passes for AO-91 (NORAD 42784):
Start: 2025-08-02 14:30:00 Europe/Berlin, End: 2025-08-02 14:40:00, Max Elevation: 35°
...
```

#### `above --lat <latitude> --lng <longitude> [--alt <altitude>] [--radius <degrees>] [--category <id>]`

List satellites currently above a location.

- `--lat <latitude>`: Observer latitude (-90 to 90 degrees, required).
- `--lng <longitude>`: Observer longitude (-180 to 180 degrees, required).
- `--alt <altitude>`: Observer altitude in meters (default: 0).
- `--radius <degrees>`: Search radius in degrees (0–90, default: 90).
- `--category <id>`: Satellite category ID (0 for all, default: 1).

```bash
n2yo-ts above --lat 34.0522 --lng -118.2437 --radius 90 --category 52 --apiKey <key>
```

**Output**:

```
Satellites above (Category: Starlink):
STARLINK-1234 (NORAD 45678): Lat: 34.10, Lng: -118.20, Alt: 550.00 km, Distance: 25.67 km
...
```

### Error Handling

The CLI handles errors gracefully and provides clear messages:

- **RateLimitError**: "Rate limit exceeded"
- **InvalidParameterError**: "Invalid parameter"
- **N2YOError**: "API request failed"
- **Other Errors**: Descriptive error message

If an error occurs, the CLI exits with a non-zero status code.

## Contributing 🤝

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

[MIT](./LICENSE) License © 2025 [Daniel](https://github.com/Dantescur)
