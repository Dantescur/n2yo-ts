import { N2YOError, RateLimitError } from './errors'
import type { N2YOClientConfig, N2YOErrorResponse } from './types'

export async function makeRequest<T>(
  baseUrl: string,
  apiKey: string,
  config: Required<N2YOClientConfig>,
  endpoint: string,
): Promise<T> {
  const url = `${baseUrl}/${endpoint}&apiKey=${apiKey}`
  try {
    if (config.debug) {
      config.debugLog(`Url to fetch: ${url}`)
    }
    const response = await fetch(url)
    if (config.debug) {
      config.debugLog(`Response status: ${response.status}`)
    }

    if (!response.ok) {
      let errorMessage = response.statusText
      if (config.debug) {
        config.debugLog(`Not ok response: ${response}`)
      }
      if (response.status === 429) {
        throw new RateLimitError('API rate limit exceeded')
      }
      try {
        const errorData = (await response.json()) as N2YOErrorResponse
        errorMessage = errorData.error || errorMessage
        throw new N2YOError(
          `API request failed: ${errorData.error || response.statusText}`,
        )
      } catch {
        throw new N2YOError(`API request failed: ${errorMessage}`)
      }
    }

    const data = (await response.json()) as T
    return data
  } catch (error) {
    if (config.debug) {
      config.debugLog(`Request failed: ${error}`)
    }
    throw error
  }
}
