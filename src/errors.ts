/**
 * Base error class for all N2YO API related errors.
 * Extends the native JavaScript Error class.
 */
export class N2YOError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'N2YOError'
  }
}

/**
 * Error thrown when the N2YO APi rate limit is exceeded.
 *
 * @remarks
 * The N2YO API has strict rate limits:
 * - Positions: 1,000 requests/hour
 * - Passes: 100 requests/hour
 * - Above: 100 requests/hour
 */
export class RateLimitError extends N2YOError {
  constructor() {
    super('API rate limit exceeded')
    this.name = 'RateLimitError'
  }
}

/**
 * Error thrown when invalid parameters are provided to API methods.
 * Includes details about which parameter was invalid and why.
 */
export class InvalidParameterError extends N2YOError {
  /**
   * Creates a new InvalidParameterError instance.
   *
   * @param param - The name of the invalid parameter
   * @param value - The invalid value that was provided
   * @param message - Explanation of why the value is invalid
   */
  constructor(param: string, value: any, message: string) {
    super(`Invalid parameter ${param}: ${value}. ${message}`)
    this.name = 'InvalidParameterError'
  }
}
