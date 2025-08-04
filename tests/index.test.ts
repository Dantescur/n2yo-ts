import { describe, expect, it } from 'vitest'
import {
  InvalidParameterError,
  N2YOClient,
  N2YOError,
  RateLimitError,
} from '../src'

describe('Exports', () => {
  it('should export N2YOClient and errors', () => {
    expect(N2YOClient).toBeDefined()
    expect(InvalidParameterError).toBeDefined()
    expect(N2YOError).toBeDefined()
    expect(RateLimitError).toBeDefined()
  })
})
