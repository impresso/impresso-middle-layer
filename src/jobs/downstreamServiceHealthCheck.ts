import { Job } from 'bullmq'
import { logger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'
import { IFetchClient } from '@/utils/http/client/base.js'
import { createFetchClient } from '@/utils/http/client/index.js'

export const JobNameDownstreamServiceHealthCheck = 'downstreamServiceHealthCheck'
export const DownstreamServiceHealthCheckJobId = 'downstream-service-health-check'
export const DownstreamServiceHealthCheckIntervalMs = 5 * 60 * 1000

const DownstreamRequestTimeoutMs = 30 * 1000
const HealthCheckText = 'Barack Obama visited Paris.'
const DefaultBaseUrl = 'https://impresso-annotation.epfl.ch/api'
const IiifImageHealthCheckUrl =
  'https://iiif-impresso.epfl.ch/iiif/3/JDG-1988-11-02-a-p0031/1818,3738,1888,1710/50,/0/default.jpg'

export interface DownstreamServiceHealthCheckJobData {
  requestedBy?: string
}

type HealthCheckAction = 'ner-nel' | 'embed-text' | 'iiif-image'

interface DownstreamServiceHealthCheckFailure {
  action: HealthCheckAction
  timeout: boolean
  errorCode: string
  details: string
}

interface DownstreamServiceHealthCheckResult {
  healthy: boolean
  checkedAt: string
  failures: DownstreamServiceHealthCheckFailure[]
}

type DownstreamServiceHealthCheckJob = Job<
  DownstreamServiceHealthCheckJobData,
  DownstreamServiceHealthCheckResult,
  typeof JobNameDownstreamServiceHealthCheck
>

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isExpectedNerNelResponse = (value: unknown): value is { sys_id: string; ts: string; nes: unknown[] } => {
  return (
    isRecord(value) &&
    typeof value.sys_id === 'string' &&
    typeof value.ts === 'string' &&
    Array.isArray(value.nes) &&
    value.nes.length > 0
  )
}

const isExpectedTextEmbeddingResponse = (value: unknown): value is { embedding: number[] } => {
  return (
    isRecord(value) &&
    Array.isArray(value.embedding) &&
    value.embedding.length > 0 &&
    value.embedding.every(number => typeof number === 'number' && Number.isFinite(number))
  )
}

const readResponseText = async (response: Response): Promise<string> => {
  try {
    return await response.text()
  } catch {
    return 'Unable to read downstream response body'
  }
}

const toHealthCheckFailureFromError = (
  action: HealthCheckAction,
  error: unknown
): DownstreamServiceHealthCheckFailure => {
  const timeoutPattern = /(timeout|timed out|abort|UND_ERR_HEADERS_TIMEOUT)/i

  if (error instanceof Error) {
    const errWithMetadata = error as Error & { code?: string; status?: number; cause?: unknown }
    const statusCode = typeof errWithMetadata.status === 'number' ? `HTTP_${errWithMetadata.status}` : undefined
    const causeCode =
      isRecord(errWithMetadata.cause) && typeof errWithMetadata.cause.code === 'string'
        ? errWithMetadata.cause.code
        : undefined

    const errorCode = causeCode ?? errWithMetadata.code ?? statusCode ?? errWithMetadata.name ?? 'UNKNOWN'
    const details = errWithMetadata.message || 'Unknown downstream error'
    return {
      action,
      timeout: timeoutPattern.test(`${errorCode} ${details}`),
      errorCode,
      details,
    }
  }

  if (typeof error === 'string') {
    return {
      action,
      timeout: timeoutPattern.test(error),
      errorCode: 'STRING_ERROR',
      details: error,
    }
  }

  return {
    action,
    timeout: false,
    errorCode: 'UNKNOWN',
    details: 'Unknown downstream error',
  }
}

const checkNerNel = async (
  client: IFetchClient,
  baseUrl: string
): Promise<DownstreamServiceHealthCheckFailure | undefined> => {
  try {
    const response = await client.fetch(
      `${baseUrl}/ner-nel/`,
      {
        method: 'POST',
        body: JSON.stringify({ data: HealthCheckText }),
        headers: { 'Content-Type': 'application/json' },
      },
      { requestTimeoutMs: DownstreamRequestTimeoutMs }
    )

    if (response.status !== 200) {
      const responseBody = await readResponseText(response)
      return {
        action: 'ner-nel',
        timeout: false,
        errorCode: `HTTP_${response.status}`,
        details: responseBody,
      }
    }

    const responseBody = await response.json()
    if (!isExpectedNerNelResponse(responseBody)) {
      return {
        action: 'ner-nel',
        timeout: false,
        errorCode: 'INVALID_RESPONSE',
        details: 'Expected sys_id, ts and at least one named entity in "nes".',
      }
    }
  } catch (error) {
    return toHealthCheckFailureFromError('ner-nel', error)
  }
}

const checkTextEmbedding = async (
  client: IFetchClient,
  baseUrl: string
): Promise<DownstreamServiceHealthCheckFailure | undefined> => {
  try {
    const response = await client.fetch(
      `${baseUrl}/text-embedder/`,
      {
        method: 'POST',
        body: JSON.stringify({ data: HealthCheckText }),
        headers: { 'Content-Type': 'application/json' },
      },
      { requestTimeoutMs: DownstreamRequestTimeoutMs }
    )

    if (response.status !== 200) {
      const responseBody = await readResponseText(response)
      return {
        action: 'embed-text',
        timeout: false,
        errorCode: `HTTP_${response.status}`,
        details: responseBody,
      }
    }

    const responseBody = await response.json()
    if (!isExpectedTextEmbeddingResponse(responseBody)) {
      return {
        action: 'embed-text',
        timeout: false,
        errorCode: 'INVALID_RESPONSE',
        details: 'Expected a non-empty numeric vector in "embedding".',
      }
    }
  } catch (error) {
    return toHealthCheckFailureFromError('embed-text', error)
  }
}

const checkIiifImage = async (
  client: IFetchClient,
  url: string,
  auth?: { user: string; pass: string }
): Promise<DownstreamServiceHealthCheckFailure | undefined> => {
  try {
    const headers: Record<string, string> = {}
    if (auth != null) {
      headers.Authorization = `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString('base64')}`
    }

    const response = await client.fetch(
      url,
      { method: 'GET', headers },
      { requestTimeoutMs: DownstreamRequestTimeoutMs }
    )

    if (response.status !== 200) {
      const responseBody = await readResponseText(response)
      return {
        action: 'iiif-image',
        timeout: false,
        errorCode: `HTTP_${response.status}`,
        details: responseBody,
      }
    }

    const contentType = response.headers.get('content-type')
    if (contentType == null || !contentType.startsWith('image/')) {
      return {
        action: 'iiif-image',
        timeout: false,
        errorCode: 'INVALID_RESPONSE',
        details: `Expected an image response, got content-type "${contentType}".`,
      }
    }
  } catch (error) {
    return toHealthCheckFailureFromError('iiif-image', error)
  }
}

export const createJobHandler = (app: ImpressoApplication) => {
  const baseUrl = app.get('impressoNerServiceUrl') ?? DefaultBaseUrl
  const client = createFetchClient({})
  const checkedActionsDescription =
    'ner-nel (/ner-nel/ with named entities), embed-text (/text-embedder/), iiif-image (default IIIF image proxy source)'

  const { defaultSourceId, sources } = app.get('images').proxy
  const iiifImageSource = sources.find(({ id }) => id === defaultSourceId) ?? sources[0]

  return async (job: DownstreamServiceHealthCheckJob): Promise<DownstreamServiceHealthCheckResult> => {
    const failures = (
      await Promise.all([
        checkNerNel(client, baseUrl),
        checkTextEmbedding(client, baseUrl),
        checkIiifImage(client, IiifImageHealthCheckUrl, iiifImageSource?.auth),
      ])
    ).filter((failure): failure is DownstreamServiceHealthCheckFailure => failure != null)

    if (failures.length > 0) {
      for (const failure of failures) {
        logger.error(
          `[JOB:${job.name}] Downstream service health check failed (action=${failure.action}, timeout=${failure.timeout}, errorCode=${failure.errorCode}): ${failure.details}`
        )
      }
    } else {
      logger.info(
        `[JOB:${job.name}] Downstream service health check succeeded. Checked actions: ${checkedActionsDescription}.`
      )
    }

    return {
      healthy: failures.length === 0,
      checkedAt: new Date().toISOString(),
      failures,
    }
  }
}
