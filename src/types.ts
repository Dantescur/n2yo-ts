// Common response structure
export interface ApiResponseInfo {
  satid?: number;
  satname?: string;
  transactionscount: number;
  category?: string;
  satcount?: number;
  passescount?: number;
}

// TLE Response
export interface TleResponse {
  info: ApiResponseInfo & {
    satid: number;
    satname: string;
  };
  tle: string;
}

// Position data
export interface SatellitePosition {
  satlatitude: number;
  satlongitude: number;
  sataltitude: number;
  azimuth: number;
  elevation: number;
  ra: number;
  dec: number;
  timestamp: number;
}

// Positions Response
export interface PositionsResponse {
  info: ApiResponseInfo & {
    satid: number;
    satname: string;
  };
  positions: SatellitePosition[];
}

// Pass data (common for visual and radio passes)
export interface SatellitePass {
  startAz: number;
  startAzCompass: string;
  startEl?: number; // Only for visual passes
  startUTC: number;
  maxAz: number;
  maxAzCompass: string;
  maxEl: number;
  maxUTC: number;
  endAz: number;
  endAzCompass: string;
  endEl?: number; // Only for visual passes
  endUTC: number;
  mag?: number; // Only for visual passes
  duration?: number; // Only for visual passes
}

// Visual Passes Response
export interface VisualPassesResponse {
  info: ApiResponseInfo & {
    satid: number;
    satname: string;
    passescount: number;
  };
  passes: SatellitePass[];
}

// Radio Passes Response
export interface RadioPassesResponse {
  info: ApiResponseInfo & {
    satid: number;
    satname: string;
    passescount: number;
  };
  passes: Omit<SatellitePass, 'startEl' | 'endEl' | 'mag' | 'duration'>[];
}

// Satellite Above data
export interface SatelliteAbove {
  satid: number;
  satname: string;
  intDesignator: string;
  launchDate: string;
  satlat: number;
  satlng: number;
  satalt: number;
}

// Above Response
export interface AboveResponse {
  info: ApiResponseInfo & {
    category: string;
    satcount: number;
  };
  above: SatelliteAbove[];
}

// Satellite categories
export const SatelliteCategories = {
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
} as const;

export type SatelliteCategoryId = keyof typeof SatelliteCategories;
export type SatelliteCategoryName = typeof SatelliteCategories[SatelliteCategoryId];
