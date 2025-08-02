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
// Find all Starlink satellites above 500km radius
const starlinks = await client.getAbove(34.0522, -118.2437, 0, 500, 52)
```

### Utility Functions

```typescript
import { getAllCategories, splitTle, timestampToDate, calculateDistance } from 'n2yo-ts'

// Split TLE into separate lines
const [line1, line2] = splitTle('1 25544U...\r\n2 25544...')

// Convert UNIX timestamp to Date object
const passTime = timestampToDate(1719878400)

// Get all satellite categories
const categories = getAllCategories()

const distance = calculateDistance(
{ lat: 40.7128, lng: -74.0060 }, // New York  City
{ lat: 51.5074, lng: -0.1278 } // London); 
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

## Contributing 🤝

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

[MIT](./LICENSE) License © 2025 [Daniel](https://github.com/Dantescur)
