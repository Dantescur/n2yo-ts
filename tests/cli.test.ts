/* eslint-disable node/prefer-global/process */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('CLI integration', () => {
  const originalArgv = process.argv
  const originalExit = process.exit
  const originalConsole = console.log

  beforeEach(() => {
    vi.resetModules()
    process.argv = [...originalArgv]
    process.exit = vi.fn() as unknown as typeof process.exit
    console.log = vi.fn()
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exit = originalExit
    console.log = originalConsole
  })

  it('should handle --list-categories flag', async () => {
    process.argv = ['node', 'cli.ts', '--list-categories']
    await import('../src/cli')
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Available Satellite Categories'),
    )
  })

  it('should handle invalid satellite name', async () => {
    process.argv = ['node', 'cli.ts', 'tle', '--sat', 'INVALID_SAT']
    await import('../src/cli')
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
