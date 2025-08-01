# N2YO TypeScript Client [![npm version](https://img.shields.io/npm/v/n2yo-ts.svg)](https://www.npmjs.com/package/n2yo-ts)

A strongly-typed TypeScript client for the N2YO.com satellite tracking API.

## Features

- Complete coverage of all N2YO API endpoints
- Strict TypeScript types for all requests and responses
- Error handling with custom error classes
- Utility functions for working with satellite data
- Well-documented with JSDoc comments

## Installation

```bash
npm install n2yo-ts
# or
yarn add n2yo-ts
# or
pnpm add n2yo-ts
```

## Usage

First, get your API key from [N2YO.com](https://www.n2yo.com/).

### Basic Example

```typescript
import { N2YOClient } from 'n2yo-ts'

// Initialize client with your API key
const client = new N2YOClient('YOUR_API_KEY')

// Get TLE for International Space Station (NORAD ID 25544)
async function getISSTle() {
  try {
    const tleData = await client.getTle(25544)
    console.log('ISS TLE:', tleData.tle)
  } catch (error) {
    console.error('Error:', error)
  }
}

getISSTle()
```

### API Methods

#### Get TLE (Two-Line Elements)

```typescript
const tleData = await client.getTle(noradId)
```

#### Get Satellite Positions

```typescript
const positions = await client.getPositions(
  noradId,
  observerLat,
  observerLng,
  observerAlt,
  seconds,
)
```

#### Get Visual Passes

```typescript
const passes = await client.getVisualPasses(
  noradId,
  observerLat,
  observerLng,
  observerAlt,
  days,
  minVisibility,
)
```

#### Get Radio Passes

```typescript
const passes = await client.getRadioPasses(
  noradId,
  observerLat,
  observerLng,
  observerAlt,
  days,
  minElevation,
)
```

#### Get Satellites Above

```typescript
const result = await client.getAbove(
  observerLat,
  observerLng,
  observerAlt,
  searchRadius,
  categoryId,
)
```

### Utility Methods

```typescript
// Split TLE into two lines
const [line1, line2] = N2YOClient.splitTle(tleData.tle)

// Convert UNIX timestamp to Date
const date = N2YOClient.timestampToDate(pass.startUTC)

// Get category name by ID
const categoryName = client.getCategoryName(18) // "Amateur radio"

// Get all categories
const allCategories = N2YOClient.getAllCategories()
```

## Error Handling

The library throws custom errors you can catch specifically:

```typescript
import { InvalidParameterError, RateLimitError } from 'n2yo-ts'

try {
  // API calls
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limit exceeded!')
  } else if (error instanceof InvalidParameterError) {
    console.log('Invalid parameter:', error.message)
  } else {
    console.log('Other error:', error)
  }
}
```

## Rate Limits

Be aware of N2YO's API rate limits:

- 1000 requests per hour for positions
- 100 requests per hour for visual passes
- 100 requests per hour for radio passes
- 100 requests per hour for "above" requests

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

## License

[MIT](./LICENSE) License © 2025 [Kevin Deng](https://github.com/sxzz)
