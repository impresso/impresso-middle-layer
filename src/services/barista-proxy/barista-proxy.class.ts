import type { Params, ServiceMethods } from '@feathersjs/feathers'
import { BadRequest } from '@feathersjs/errors'
import { BaristaConfig } from '@/models/generated/app/configuration.js'
import type { ImpressoApplication } from '@/types.js'
import { v4 } from 'uuid'
import { SlimUser } from '@/authentication.js'
import { request, Dispatcher } from 'undici'
import { EventEmitter } from 'stream'
import BaristaConversation from '@/models/barista-conversations.model.js'

export interface BaristaRequest {
  /**
   * Additionalinstructions
   * @description Additional instructions to guide the agent's response. This is an extra added in addition to the system prompt.
   */
  additionalInstructions?: string | null
  /**
   * Message
   * @description The message to send to the Barista agent.
   */
  message: string
  /**
   * Modelid
   * @description The ID of the model to use.
   */
  modelId?:
    | (
        | 'llama-3.3-70b-versatile'
        | 'llama-3.1-8b-instant'
        | 'qwen/qwen3-32b'
        | 'openai/gpt-oss-20b'
        | 'openai/gpt-oss-120b'
      )
    | null
  /**
   * Agent type to use.
   */
  agentType?: 'react' | 'router' | 'skills'
  /** @description Current query filters for the context, if different from the last set in the conversation. */
  searchQuery?: {
    /**
     * Filters
     * @description List of filters to apply
     */
    filters?: {
      /**
       * Context
       * @description Filter context
       * @default include
       * @enum {string}
       */
      context: 'include' | 'exclude'
      /**
       * Op
       * @description Filter operator. Choice depends on filter type and context.
       * @default AND
       * @enum {string}
       */
      op: 'AND' | 'OR'
      /**
       * Precision
       * @description Filter precision
       * @default exact
       * @enum {string}
       */
      precision: 'exact' | 'partial' | 'fuzzy' | 'soft'
      /**
       * Q
       * @description Value depends on the filter type. For boolean filters - not required. Non-string types should be converted to string.
       */
      q?: string[] | string
      /**
       * Type
       * @description Filter type
       * @enum {string}
       */
      type:
        | 'hasTextContents'
        | 'ocrQuality'
        | 'contentLength'
        | 'isFront'
        | 'string'
        | 'title'
        | 'daterange'
        | 'uid'
        | 'copyright'
        | 'partner'
        | 'language'
        | 'page'
        | 'issue'
        | 'newspaper'
        | 'topic'
        | 'year'
        | 'type'
        | 'sourceMedium'
        | 'sourceType'
        | 'country'
        | 'mention'
        | 'person'
        | 'location'
        | 'nag'
        | 'org'
        | 'regex'
        | 'textReuseClusterSize'
        | 'textReuseClusterLexicalOverlap'
        | 'textReuseClusterDayDelta'
        | 'contentItemId'
        | 'textReusePassage'
        | 'imageTechnique'
    }[]
  } | null
  /**
   * Sessionid
   * @description Session ID for the conversation.
   */
  sessionId?: string | null
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
  private readonly conversationModel: ReturnType<typeof BaristaConversation.initialize>

  constructor(app: ImpressoApplication, config?: BaristaConfig) {
    this.app = app
    this.config = config
    this.conversationModel = BaristaConversation.initialize(app.get('sequelizeClient') as any)
  }

  private async touchConversation(sessionId: string | null | undefined, userId: number | undefined): Promise<void> {
    if (!sessionId || userId == null) return
    await this.conversationModel
      .update({ dateLastModified: new Date() }, { where: { baristaSessionId: sessionId, userId } })
      .catch(() => {})
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
      body: JSON.stringify(data),
    })

    if (response.statusCode !== 200) {
      throw new BadRequest(`Barista returned status code ${response.statusCode}`)
    }

    // Check if the response is a stream
    const contentType = response.headers['content-type']
    if (contentType?.includes('text/event-stream') || contentType == null) {
      return this.handleStream(response, params, data.sessionId)
    }

    // Fallback to JSON response
    const chunks = []
    for await (const chunk of response.body) {
      chunks.push(chunk)
    }
    const responseData = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    await this.touchConversation(data.sessionId, params?.user?.id)
    return responseData as BaristaResponse
  }

  private async handleStream(
    response: Dispatcher.ResponseData,
    params?: Params<any> & CreateParams,
    sessionId?: string | null
  ): Promise<BaristaResponse> {
    const decoder = new TextDecoder()
    const messages: any[] = []
    let buffer = ''

    const userUid = params?.user?.uid

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
                userUid,
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
        userUid,
      })

      await this.touchConversation(sessionId, params?.user?.id)
      return { messages: [] }
    } catch (error) {
      // Emit error event
      eventEmitter.emit('barista-response', {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        userUid,
      })
      throw new BadRequest('Stream reading failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }
}
