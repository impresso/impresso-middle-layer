import type { Params, ServiceMethods } from '@feathersjs/feathers'
import { BadRequest } from '@feathersjs/errors'
import { BaristaConfig } from '@/models/generated/common.js'
import type { ImpressoApplication } from '@/types.js'
import { v4 } from 'uuid'
import { SlimUser } from '@/authentication.js'
import { request, Dispatcher } from 'undici'
import { EventEmitter } from 'stream'

export interface BaristaRequest {
  message: string
}

export interface BaristaResponse {
  messages: any
}

export interface BaristaStreamChunk {
  data?: string
  type?: string
  done?: boolean
  error?: string
}

interface CreateParams {
  user?: SlimUser
}

export class BaristaProxy implements Pick<ServiceMethods<BaristaResponse, BaristaRequest>, 'create'> {
  private readonly config?: BaristaConfig
  private readonly app: ImpressoApplication

  constructor(app: ImpressoApplication, config?: BaristaConfig) {
    this.app = app
    this.config = config
  }

  async create(data: BaristaRequest, params?: Params & CreateParams): Promise<BaristaResponse> {
    if (!this.config) {
      throw new BadRequest('Barista is not configured')
    }

    if (!data.message) {
      throw new BadRequest('Message is required')
    }

    const response = await request(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        message: data.message,
        session_id: params?.user?.uid || v4(),
      }),
    })

    if (response.statusCode !== 200) {
      throw new BadRequest(`Barista returned status code ${response.statusCode}`)
    }

    // Check if the response is a stream
    const contentType = response.headers['content-type']
    if (contentType?.includes('text/event-stream') || contentType == null) {
      return this.handleStream(response, params)
    }

    // Fallback to JSON response
    const chunks = []
    for await (const chunk of response.body) {
      chunks.push(chunk)
    }
    const responseData = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return responseData as BaristaResponse
  }

  private async handleStream(
    response: Dispatcher.ResponseData,
    params?: Params<any> & CreateParams
  ): Promise<BaristaResponse> {
    const decoder = new TextDecoder()
    const messages: any[] = []
    let buffer = ''

    const eventEmitter = this as any as EventEmitter

    try {
      for await (const chunk of response.body) {
        // Decode the chunk and add to buffer
        buffer += decoder.decode(chunk, { stream: true })

        // Process complete SSE messages in the buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'done') {
                // Stream is done
                break
              }

              messages.push(parsed)

              eventEmitter.emit('barista-response', {
                type: 'chunk',
                data: parsed['messages'] ?? [],
              })
            } catch (error) {
              // Skip invalid JSON
              console.error('Failed to parse SSE data:', error)
            }
          }
        }
      }

      // Emit completion event
      eventEmitter.emit('barista-response', {
        type: 'done',
        data: [],
      })

      return { messages: [] }
    } catch (error) {
      // Emit error event
      eventEmitter.emit('barista-response', {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw new BadRequest('Stream reading failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }
}
