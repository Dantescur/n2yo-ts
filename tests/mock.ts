import type {
  AboveResponse,
  PositionsResponse,
  RadioPassesResponse,
  TleResponse,
  VisualPassesResponse,
} from '../src'

export const mockTleResponse: TleResponse = {
  info: {
    satid: 25544,
    satname: 'ISS',
    transactionscount: 1,
  },
  tle: '1 25544U 98067A 23012.34567890 .00012345 00000-0 12345-4 0 9999\r\n2 25544 51.6412 112.8495 0001928 208.4187 178.9720 15.54106440104358',
}

export const mockPositionsResponse: PositionsResponse = {
  info: {
    satid: 25544,
    satname: 'ISS',
    transactionscount: 1,
  },
  positions: [
    {
      satlatitude: 40.7128,
      satlongitude: -74.006,
      sataltitude: 420,
      azimuth: 180,
      elevation: 45,
      ra: 123.45,
      dec: 67.89,
      timestamp: 1672531200,
    },
  ],
}

export const mockVisualPassesResponse: VisualPassesResponse = {
  info: {
    satid: 25544,
    satname: 'ISS',
    transactionscount: 1,
    passescount: 1,
  },
  passes: [
    {
      startAz: 180,
      startAzCompass: 'S',
      startEl: 10,
      startUTC: 1672531200,
      maxAz: 270,
      maxAzCompass: 'W',
      maxEl: 45,
      maxUTC: 1672531300,
      endAz: 0,
      endAzCompass: 'N',
      endEl: 10,
      endUTC: 1672531400,
      mag: -1.5,
      duration: 200,
    },
  ],
}

export const mockRadioPassesResponse: RadioPassesResponse = {
  info: {
    satid: 25544,
    satname: 'ISS',
    transactionscount: 1,
    passescount: 1,
  },
  passes: [
    {
      startAz: 180,
      startAzCompass: 'S',
      startUTC: 1672531200,
      maxAz: 270,
      maxAzCompass: 'W',
      maxEl: 45,
      maxUTC: 1672531300,
      endAz: 0,
      endAzCompass: 'N',
      endUTC: 1672531400,
    },
  ],
}

export const mockAboveResponse: AboveResponse = {
  info: {
    category: 'Amateur radio',
    transactionscount: 1,
    satcount: 2,
  },
  above: [
    {
      satid: 12345,
      satname: 'SAT-1',
      intDesignator: '1990-013C',
      launchDate: '1990-02-07',
      satlat: 40,
      satlng: -75,
      satalt: 500,
    },
  ],
}
