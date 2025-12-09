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

  constructor(details: ParsedSolrErrorDetails) {
    super(`SolrError ${details.code}: ${details.message}`)
    this.name = 'SolrError'
    this.details = details
  }
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
