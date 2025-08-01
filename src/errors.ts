export class N2YOError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'N2YOError'
  }
}

export class RateLimitError extends N2YOError {
  constructor() {
    super('API rate limit exceeded')
    this.name = 'RateLimitError'
  }
}

export class InvalidParameterError extends N2YOError {
  constructor(param: string, value: any, message: string) {
    super(`Invalid parameter ${param}: ${value}. ${message}`)
    this.name = 'InvalidParameterError'
  }
}
