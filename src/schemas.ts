import { z } from 'zod'
import { InvalidParameterError } from './errors'
import type { SatelliteCategoryId } from './types'

export const NoradIdSchema = z
  .number()
  .int({ message: 'NORAD ID must be an integer' })
  .positive({ message: 'NORAD ID must be positive' })

export const LatitudeSchema = z
  .number()
  .min(-90, { message: 'Latitude must be between -90 and 90 degrees' })
  .max(90, { message: 'Latitude must be between -90 and 90 degrees' })

export const LongitudeSchema = z
  .number()
  .min(-180, { message: 'Longitude must be between -180 and 180 degrees' })
  .max(180, { message: 'Longitude must be between -180 and 180 degrees' })

export const AltitudeSchema = z
  .number()
  .min(-1000, { message: 'Altitude must be between -1000 and 10000 meters' })
  .max(10000, { message: 'Altitude must be between -1000 and 10000 meters' })

export const GetPositionsParamsSchema = z.object({
  id: NoradIdSchema,
  observerLat: LatitudeSchema,
  observerLng: LongitudeSchema,
  observerAlt: AltitudeSchema,
  seconds: z
    .number()
    .int({ message: 'Seconds must be an integer' })
    .min(1, { message: 'Seconds must be between 1 and 300' })
    .max(300, { message: 'Seconds must be between 1 and 300' }),
})

export const GetVisualPassesParamsSchema = z.object({
  id: NoradIdSchema,
  observerLat: LatitudeSchema,
  observerLng: LongitudeSchema,
  observerAlt: AltitudeSchema,
  days: z
    .number()
    .int({ message: 'Days must be an integer' })
    .min(1, { message: 'Days must be between 1 and 10' })
    .max(10, { message: 'Days must be between 1 and 10' }),
  minVisibility: z
    .number()
    .positive({ message: 'Minimum visibility must be positive' }),
})

export const GetRadioPassesParamsSchema = z.object({
  id: NoradIdSchema,
  observerLat: LatitudeSchema,
  observerLng: LongitudeSchema,
  observerAlt: AltitudeSchema,
  days: z
    .number()
    .int({ message: 'Days must be an integer' })
    .min(1, { message: 'Days must be between 1 and 10' })
    .max(10, { message: 'Days must be between 1 and 10' }),
  minElevation: z
    .number()
    .min(0, { message: 'Minimum elevation must be non-negative' }),
})

export const GetAboveParamsSchema = z.object({
  observerLat: LatitudeSchema,
  observerLng: LongitudeSchema,
  observerAlt: AltitudeSchema,
  searchRadius: z
    .number()
    .min(0, { message: 'Search radius must be between 0 and 90 degrees' })
    .max(90, { message: 'Search radius must be between 0 and 90 degrees' }),
  categoryId: z.number().int().min(0) as z.ZodType<SatelliteCategoryId>,
})

export const UtcToLocalParamsSchema = z.object({
  utcTimestamp: z
    .number()
    .finite({ message: 'Timestamp must be a valid number' })
    .refine((val) => !Number.isNaN(val), {
      message: 'Timestamp must not be NaN',
    }),
  timeZone: z
    .string()
    .min(1, { message: 'Time zone must not be empty' })
    .refine(
      (val) =>
        val.toUpperCase() === 'UTC' ||
        Intl.supportedValuesOf('timeZone').includes(val),
      { message: 'Invalid IANA time zone' },
    ),
})

export const GetTleParamsSchema = z.object({
  id: NoradIdSchema,
})

export const GetTleByNameParamsSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Satellite name must not be empty' })
    .transform((val) => val.toUpperCase()),
})

// Inferred TypeScript types
export type GetPositionsParams = z.infer<typeof GetPositionsParamsSchema>
export type GetVisualPassesParams = z.infer<typeof GetVisualPassesParamsSchema>
export type GetRadioPassesParams = z.infer<typeof GetRadioPassesParamsSchema>
export type GetAboveParams = z.infer<typeof GetAboveParamsSchema>
export type UtcToLocalParams = z.infer<typeof UtcToLocalParamsSchema>
export type GetTleParams = z.infer<typeof GetTleParamsSchema>
export type GetTleByNameParams = z.infer<typeof GetTleByNameParamsSchema>

/**
 * Converts a Zod validation error to an InvalidParameterError.
 * @param error - The Zod validation error.
 * @throws {InvalidParameterError} With the parameter path, value, and message from the first issue, or a generic error if no issues exist.
 */
export function mapZodErrorToInvalidParameterError(error: z.ZodError): never {
  const issue = error.issues[0]! // NOTE: This is ok right?
  const path = issue.path.join('.')
  const value =
    issue.path.reduce((obj, key) => (obj as any)?.[key], {}) ?? 'unknown'
  throw new InvalidParameterError(path, value, issue.message)
}
