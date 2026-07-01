/**
 * Structured details extracted from an HTTP error, suitable for passing
 * as a trailing object to `logger.error(msg, details)`.
 */
export interface HttpErrorDetails {
  requestUrl?: string
  requestBody?: string
  responseStatus?: number
  responseBody?: string
}

export interface FormatHttpErrorContext {
  /** Request URL, when not available on the error itself (Fetch/undici). */
  url?: string
  /** Request body, when not available on the error itself. */
  requestBody?: string | Record<string, any> | null
  /** Pre-extracted response status (e.g. already read from a Response). */
  responseStatus?: number
  /** Pre-extracted response body (e.g. already read via `response.text()`). */
  responseBody?: string
}

const safeStringify = (value: unknown): string => {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const readAsyncBody = async (body: unknown): Promise<string | undefined> => {
  if (body == null || typeof body !== 'object') return undefined
  try {
    const chunks: Buffer[] = []
    for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString('utf8')
  } catch {
    return undefined
  }
}

/**
 * Extract structured details `{ requestUrl, requestBody, responseStatus, responseBody }`
 * from an HTTP error.
 *
 * Handles Axios-style errors (`error.config`, `error.response.data`),
 * Fetch `Response` objects, undici `Dispatcher.ResponseData`, and custom
 * errors created by `checkResponseStatus` (`error.response = { statusCode, body }`).
 *
 * The optional `context` supplies request-side info that Fetch/undici errors
 * typically don't carry, as well as pre-read response fields when the body
 * stream has already been consumed.
 *
 * This function never throws — if extraction fails it returns whatever it
 * could gather.
 */
export const formatHttpError = async (
  error: unknown,
  context?: FormatHttpErrorContext
): Promise<HttpErrorDetails> => {
  const details: HttpErrorDetails = {}

  // --- Request side from context ---
  if (context?.url) details.requestUrl = context.url
  if (context?.requestBody != null) {
    details.requestBody = safeStringify(context.requestBody)
  }

  // --- Pre-extracted response fields from context ---
  if (context?.responseStatus != null) details.responseStatus = context.responseStatus
  if (context?.responseBody != null) details.responseBody = context.responseBody

  const err = error as any

  // --- Request side from Axios-style config ---
  if (details.requestUrl == null && err?.config?.url != null) {
    details.requestUrl = err.config.url
  }
  if (details.requestBody == null && err?.config?.data != null) {
    details.requestBody = safeStringify(err.config.data)
  }

  // --- Resolve the response object ---
  // Could be on `error.response` (Axios / checkResponseStatus),
  // or the error/response object itself (Fetch Response, undici ResponseData).
  const response =
    err?.response ??
    (typeof err?.status === 'number' || typeof err?.statusCode === 'number' ? err : undefined)

  if (response != null) {
    if (details.responseStatus == null) {
      if (typeof response.status === 'number') details.responseStatus = response.status
      else if (typeof response.statusCode === 'number') details.responseStatus = response.statusCode
    }

    if (details.responseBody == null) {
      if (typeof response.body === 'string') {
        // checkResponseStatus sets error.response.body as a string
        details.responseBody = response.body
      } else if (typeof response.text === 'function') {
        // Fetch / XResponse — body may or may not be consumed
        try {
          details.responseBody = await response.text()
        } catch {
          // body already consumed — ignore
        }
      } else if (response.data != null) {
        // Axios
        details.responseBody = safeStringify(response.data)
      } else if (response.body != null) {
        // undici stream
        details.responseBody = await readAsyncBody(response.body)
      }
    }
  }

  // --- Direct status on error itself (undici errors, etc.) ---
  if (details.responseStatus == null) {
    if (typeof err?.status === 'number') details.responseStatus = err.status
    else if (typeof err?.statusCode === 'number') details.responseStatus = err.statusCode
  }

  return details
}
