import { describe, expect, it } from 'vitest'
import * as n2yo from '../src/index'

describe('index.ts exports', () => {
  it('should export all error types', () => {
    expect(n2yo).toHaveProperty('N2YOError')
    expect(n2yo).toHaveProperty('RateLimitError')
    expect(n2yo).toHaveProperty('InvalidParameterError')

    // Verify these are actually classes
    expect(new n2yo.N2YOError('test')).toBeInstanceOf(Error)
    expect(new n2yo.RateLimitError()).toBeInstanceOf(n2yo.N2YOError)
    expect(
      new n2yo.InvalidParameterError('param', 'value', 'message'),
    ).toBeInstanceOf(n2yo.N2YOError)
  })
})
