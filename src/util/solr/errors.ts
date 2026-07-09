import type { HttpErrorDetails } from '@/utils/formatHttpError.js'

export interface ParsedSolrErrorDetails {
  /**
   * Codes we support:
   * 400: bad request - malformed query
   * 500: internal server error - solr is having issues
   * 504: service timed out - solr timed out
   */
  code: 400 | 500 | 504
  /** Error message */
  message: string
  /** Original query params, if available */
  params?: string
}

export class SolrError extends Error {
  details: ParsedSolrErrorDetails
  /** Raw HTTP error details (request URL, body, response status/body) for logging. */
  httpError?: HttpErrorDetails

  constructor(details: ParsedSolrErrorDetails, httpError?: HttpErrorDetails) {
    super(`SolrError ${details.code}: ${details.message}`)
    this.name = 'SolrError'
    this.details = details
    this.httpError = httpError
  }
}

interface FormatSolrErrorOptions {
  requestLongStringLimit?: number
  responseLongStringLimit?: number
  responseDocsLimit?: number
}

const DefaultRequestLongStringLimit = 2_000
const DefaultResponseLongStringLimit = 500
const DefaultResponseDocsLimit = 1

const truncateMiddle = (value: string, limit: number): string => {
  if (value.length <= limit) {
    return value
  }

  const marker = `... [truncated ${value.length - limit} chars] ...`
  const available = Math.max(limit - marker.length, 0)
  const headLength = Math.ceil(available * 0.7)
  const tailLength = available - headLength

  return `${value.slice(0, headLength)}${marker}${tailLength > 0 ? value.slice(-tailLength) : ''}`
}

const parseJsonForLogging = (value: string | undefined): unknown => {
  if (value == null) {
    return undefined
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

const sanitizeSolrValueForLogging = (
  value: unknown,
  options: Required<FormatSolrErrorOptions>,
  path: string[] = [],
  bodyKind: 'request' | 'response'
): unknown => {
  if (typeof value === 'string') {
    const limit = bodyKind === 'request' ? options.requestLongStringLimit : options.responseLongStringLimit

    return truncateMiddle(value, limit)
  }

  if (Array.isArray(value)) {
    if (bodyKind === 'response' && path.at(-2) === 'response' && path.at(-1) === 'docs') {
      return value.slice(0, options.responseDocsLimit).map(item =>
        sanitizeSolrValueForLogging(item, options, path, bodyKind)
      )
    }

    return value.map((item, index) => sanitizeSolrValueForLogging(item, options, [...path, String(index)], bodyKind))
  }

  if (!isRecord(value)) {
    return value
  }

  const result: Record<string, unknown> = {}
  for (const [key, childValue] of Object.entries(value)) {
    result[key] = sanitizeSolrValueForLogging(childValue, options, [...path, key], bodyKind)
  }

  if (
    bodyKind === 'response' &&
    path.length === 1 &&
    path[0] === 'response' &&
    Array.isArray(value.docs) &&
    value.docs.length > options.responseDocsLimit
  ) {
    result.docs_truncated = {
      shown: options.responseDocsLimit,
      total: value.docs.length,
    }
  }

  return result
}

const formatBodyForLogging = (
  body: string | undefined,
  bodyKind: 'request' | 'response',
  options: Required<FormatSolrErrorOptions>
): string => {
  const parsedBody = parseJsonForLogging(body)
  if (parsedBody == null) {
    return '<empty>'
  }

  const sanitizedBody = sanitizeSolrValueForLogging(parsedBody, options, [], bodyKind)
  return typeof sanitizedBody === 'string' ? sanitizedBody : JSON.stringify(sanitizedBody, null, 2)
}

export const formatSolrErrorForLogging = (error: SolrError, options?: FormatSolrErrorOptions): string => {
  const resolvedOptions = {
    requestLongStringLimit: options?.requestLongStringLimit ?? DefaultRequestLongStringLimit,
    responseLongStringLimit: options?.responseLongStringLimit ?? DefaultResponseLongStringLimit,
    responseDocsLimit: options?.responseDocsLimit ?? DefaultResponseDocsLimit,
  }

  return [
    `SOLR error: ${error.message}`,
    'POST body:',
    formatBodyForLogging(error.httpError?.requestBody, 'request', resolvedOptions),
    `Response status: ${error.httpError?.responseStatus ?? '<unknown>'}`,
    'Response body:',
    formatBodyForLogging(error.httpError?.responseBody, 'response', resolvedOptions),
  ].join('\n')
}

interface StandardSolrResponse {
  responseHeader: {
    status: number
    params:
      | {
          json?: string
        }
      | Record<string, any>
  }
  error?: {
    msg: string
    code: number
    metadata?: string[]
  }
}

/**
 * Solr does not always respect HTTP status codes in its responses.
 * Given a Solr response body, determine if the response is an error.
 * If it's not an error, return undefined.
 * If it is, return the parsed error details.
 * @param responseBody
 * @returns parsed details.
 */
export const getSolrErrorDetails = (responseBody: Record<string, any>): ParsedSolrErrorDetails | undefined => {
  const response = responseBody as StandardSolrResponse
  // Check if responseHeader exists and has a status
  const status = response.responseHeader.status

  // Status 0 means success in Solr
  if (status === 0) {
    return undefined
  }

  // Get the error message
  const message = response.error?.msg || 'Unknown error'

  // If status is not 0, we have an error
  // Determine the error code - prefer error.code if available, otherwise use status
  let code: 400 | 500 | 504

  // Check if this is a timeout error by looking at metadata
  const isTimeout =
    response.error?.metadata &&
    response.error.metadata.length > 0 &&
    response.error.metadata[response.error.metadata.length - 1] === 'java.util.concurrent.TimeoutException'

  if (isTimeout) {
    code = 504
  } else if (response.error?.code === 400) {
    code = 400
  } else if (response.error?.code === 504) {
    code = 504
  } else if (response.error?.code === 500 || status === 500) {
    code = 500
  } else if (status === 400) {
    code = 400
  } else if (status === 504) {
    code = 504
  } else {
    // Default to 500 for unknown error statuses
    code = 500
  }

  // Get params if available
  let params: string | undefined
  if (response.responseHeader.params) {
    const paramsObj = response.responseHeader.params
    if (typeof paramsObj.json === 'string') {
      // If params contain a json field, use it directly
      params = paramsObj.json
    } else {
      // Otherwise, stringify the entire params object
      params = JSON.stringify(paramsObj)
    }
  }

  return {
    code,
    message,
    params,
  }
}
