import { IFetchClient } from './http/client/base'
import { logger } from '../logger'

export const sendDownstreamRequest = async <R extends { [key: string]: any }, T>(
  client: IFetchClient,
  url: string,
  body: R,
  responseConverter: (data: any) => T
) => {
  const response = await client.fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5 * 60 * 1000), // 5 minutes
  })

  if (response.status !== 200) {
    let bodyText = ''
    try {
      bodyText = String(await response.text())
    } catch {
      /* ignore */
    }

    logger.error(`Failed to fetch downstream data. Error (${response.status}): ${bodyText}`)
    throw new Error('Failed to fetch downstream data')
  }

  try {
    const responseBody = await response.json()
    return responseConverter(responseBody)
  } catch (error) {
    logger.error('Failed to parse downstream response', error)
    throw new Error('Failed to parse downstream response')
  }
}
