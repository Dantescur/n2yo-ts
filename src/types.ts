/**
 * Core interface representing common response metadata
 * returned by all N2YO API endpoints.
 */
export interface ApiResponseInfo {
  /** Satellite NORAD ID (when applicable) */
  satid?: number
  /** Satellite name (when applicable) */
  satname?: string
  /** Number of API transactions used */
  transactionscount: number
  /** Category name (for 'above' endpoint) */
  category?: string
  /** Number of satellites returned (for 'above' endpoint) */
  satcount?: number
  /** Number of passes returned (for passes endpoints) */
  passescount?: number
}

/**
 * Interface representing a Two-Line Element (TLE) response.
 */
export interface TleResponse {
  info: ApiResponseInfo & {
    /** Satellite NORAD ID */
    satid: number
    /** Satellite name */
    satname: string
  }
  /** The complete TLE string (tow lines separated by CRLF) */
  tle: string
}

/**
 * Represents a single satellite position at a specific time.
 */
export interface SatellitePosition {
  /** Satellite latitude in degrees */
  satlatitude: number
  /** Satellite longitude in degrees */
  satlongitude: number
  /** Satellite altitude in kilometers */
  sataltitude: number
  /** Azimuth in degrees */
  azimuth: number
  /** Elevation in degrees */
  elevation: number
  /** Right ascension */
  ra: number
  /** Declination */
  dec: number
  /** UNIX timestamp of the position */
  timestamp: number
}

/**
 * Interface representing a satellite positions response.
 */
export interface PositionsResponse {
  info: ApiResponseInfo & {
    /** Satellite NORAD ID */
    satid: number
    /** Satellite name */
    satname: string
  }
  /** Array of satellite positions */
  positions: SatellitePosition[]
}

/**
 * Data describing a single satellite pass (common schema for visual and radio passes).
 */
export interface SatellitePass {
  /** Azimuth at the start of the pass, in degrees (0–360) */
  startAz: number
  /** Cardinal compass direction at the start of the pass (e.g., “N”, “SW”) */
  startAzCompass: string
  /** Elevation at the start of the pass, in degrees (only returned for visual passes) */
  startEl?: number
  /** Unix timestamp (UTC) marking the start of the pass */
  startUTC: number
  /** Azimuth at the maximum elevation, in degrees (0–360) */
  maxAz: number
  /** Cardinal compass direction at the maximum elevation */
  maxAzCompass: string
  /** Maximum elevation reached during the pass, in degrees */
  maxEl: number
  /** Unix timestamp (UTC) marking the maximum elevation */
  maxUTC: number
  /** Azimuth at the end of the pass, in degrees (0–360) */
  endAz: number
  /** Cardinal compass direction at the end of the pass */
  endAzCompass: string
  /** Elevation at the end of the pass, in degrees (only returned for visual passes) */
  endEl?: number
  /** Unix timestamp (UTC) marking the end of the pass */
  endUTC: number
  /** Visual magnitude (brightness) of the satellite at max elevation (only returned for visual passes) */
  mag?: number
  /** Total pass duration in seconds (only returned for visual passes) */
  duration?: number
}

/**
 * Response returned by the `/visualpasses` endpoint.
 * Contains all upcoming visual (sunlit) passes for the requested satellite and location.
 */
export interface VisualPassesResponse {
  info: ApiResponseInfo & {
    /** Satellite NORAD ID */
    satid: number
    /** Satellite name */
    satname: string
    /** Number of passes returned */
    passescount: number
  }
  /** Array of visual passes */
  passes: SatellitePass[]
}

/**
 * Response returned by the `/radiopasses` endpoint.
 * Contains all upcoming radio (non-visual) passes for the requested satellite and location.
 */
export interface RadioPassesResponse {
  info: ApiResponseInfo & {
    /** Satellite NORAD ID */
    satid: number
    /** Satellite name */
    satname: string
    /** Number of passes returned */
    passescount: number
  }
  /** Array of radio passes (excludes visual-only fields) */
  passes: Omit<SatellitePass, 'startEl' | 'endEl' | 'mag' | 'duration'>[]
}

/**
 * Single satellite record returned by the `/above` endpoint.
 */
export interface SatelliteAbove {
  /** Satellite NORAD ID */
  satid: number
  /** Satellite name */
  satname: string
  /** International designator (COSPAR ID) */
  intDesignator: string
  /** Launch date in YYYY-MM-DD format */
  launchDate: string
  /** Sub-satellite latitude at query epoch, in degrees */
  satlat: number
  /** Sub-satellite longitude at query epoch, in degrees */
  satlng: number
  /** Altitude above sea level, in kilometers */
  satalt: number
}

/**
 * Response returned by the `/above` endpoint.
 * Lists all visible satellites above a specified observer location and minimum elevation.
 */
export interface AboveResponse {
  info: ApiResponseInfo & {
    /** Category name (matches the query) */
    category: string
    /** Number of satellites returned */
    satcount: number
  }
  /** Array of satellites currently above the horizon */
  above: SatelliteAbove[]
}

/**
 * Comprehensive list of satellite categories supported by N2YO.
 *
 * @remarks
 * The numeric keys correspond to category IDs used in API requests.
 * The string values are human-readable category names.
 */
export const SatelliteCategories = {
  0: 'All',
  1: 'Brightest',
  2: 'ISS',
  3: 'Weather',
  4: 'NOAA',
  5: 'GOES',
  6: 'Earth resources',
  7: 'Search & rescue',
  8: 'Disaster monitoring',
  9: 'Tracking and Data Relay Satellite System',
  10: 'Geostationary',
  11: 'Intelsat',
  12: 'Gorizont',
  13: 'Raduga',
  14: 'Molniya',
  15: 'Iridium',
  16: 'Orbcomm',
  17: 'Globalstar',
  18: 'Amateur radio',
  19: 'Experimental',
  20: 'Global Positioning System (GPS) Operational',
  21: 'Glonass Operational',
  22: 'Galileo',
  23: 'Satellite-Based Augmentation System',
  24: 'Navy Navigation Satellite System',
  25: 'Russian LEO Navigation',
  26: 'Space & Earth Science',
  27: 'Geodetic',
  28: 'Engineering',
  29: 'Education',
  30: 'Military',
  31: 'Radar Calibration',
  32: 'CubeSats',
  33: 'XM and Sirius',
  34: 'TV',
  35: 'Beidou Navigation System',
  36: 'Yaogan',
  37: 'Westford Needles',
  38: 'Parus',
  39: 'Strela',
  40: 'Gonets',
  41: 'Tsiklon',
  42: 'Tsikada',
  43: 'O3B Networks',
  44: 'Tselina',
  45: 'Celestis',
  46: 'IRNSS',
  47: 'QZSS',
  48: 'Flock',
  49: 'Lemur',
  50: 'Global Positioning System (GPS) Constellation',
  51: 'Glonass Constellation',
  52: 'Starlink',
  53: 'OneWeb',
  54: 'Chinese Space Station',
  55: 'Qianfan',
  56: 'Kuiper',
} as const

/**
 * Type representing valid satellite category IDs (1-56).
 */
export type SatelliteCategoryId = keyof typeof SatelliteCategories | '0'

/**
 * Type representing valid satellite category names.
 */
export type SatelliteCategoryName =
  (typeof SatelliteCategories)[SatelliteCategoryId]

export interface Coordinate {
  /** Latitude in decimal degrees */
  lat: number
  /** Longitude in decimal degrees */
  lng: number
}

/**
 * Mapping of common satellite names to their NORAD IDs.
 */
export const COMMON_SATELLITES: Record<string, number> = {
  ISS: 25544,
  HUBBLE: 20580,
  STARLINK_1: 44235,
  NOAA_15: 25338,
  NOAA_18: 28654,
  NOAA_19: 33591,
  GOES_16: 41866,
  GOES_17: 43226,
  TIANGONG: 48274,
  JWST: 50463,
  TERRA: 25994,
  AQUA: 27424,
  LANDSAT_8: 39084,
  SENTINEL_1A: 39634,
  IRIDIUM_NEXT_1: 41917,
  ONEWEB_1: 44713,
  AO_91: 43017,
  AO_92: 43137,
  SO_50: 27607,
} as const
