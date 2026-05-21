import type { InferAttributes, Sequelize } from 'sequelize'
import type { Id, Params } from '@feathersjs/feathers'
import { BadRequest, NotFound } from '@feathersjs/errors'
import { request } from 'undici'
import type { ImpressoApplication } from '@/types.js'
import type { SlimUser } from '@/authentication.js'
import BaristaConversation from '@/models/barista-conversations.model.js'
import { PublicFindResponse } from '@/models/common.js'

export interface FindQuery {
  limit?: number
  offset?: number
}

export interface CreateData {
  baristaSessionId: string
}

export interface PatchData {
  label: string
}

export type FindResult = PublicFindResponse<BaristaConversation>

export interface HistoryMessage {
  id: string
  type: string
  content: string
  suggestedConversationTitle?: string
}

interface HistoryResponse {
  messages: HistoryMessage[]
}

export type BaristaConversationWithHistory = InferAttributes<BaristaConversation> & { messages: HistoryMessage[] }

async function fetchHistory(historyUrl: string, sessionId: string): Promise<HistoryResponse> {
  const url = new URL(historyUrl)
  url.searchParams.set('sessionId', sessionId)

  const response = await request(url.toString(), { method: 'GET' })

  if (response.statusCode === 404) {
    throw new NotFound(`Barista session '${sessionId}' not found`)
  }
  if (response.statusCode !== 200) {
    throw new BadRequest(`Barista history endpoint returned status ${response.statusCode}`)
  }

  const chunks: Buffer[] = []
  for await (const chunk of response.body) {
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as HistoryResponse
}


function requireUserId(user?: SlimUser): number {
  if (user?.id == null) throw new BadRequest('Authenticated user is required')
  return user.id
}

export class BaristaConversationsService {
  protected readonly sequelizeClient: Sequelize
  protected readonly model: ReturnType<typeof BaristaConversation.initialize>
  protected readonly historyUrl?: string

  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.model = BaristaConversation.initialize(this.sequelizeClient)
    const baristaConfig = app.get('features')?.barista
    this.historyUrl = baristaConfig?.historyUrl ?? baristaConfig?.url?.replace('/chat/stream', '/chat/history')
  }

  async find(params?: Params & { query?: FindQuery; user?: SlimUser }): Promise<FindResult> {
    const { limit = 10, offset = 0 } = params?.query ?? {}
    const userId = requireUserId(params?.user)

    const { rows, count: total } = await this.model.findAndCountAll({
      where: { userId },
      limit,
      offset,
      order: [['date_last_modified', 'DESC']],
    })

    return {
      pagination: { limit, offset, total },
      data: rows.map(row => row.toJSON() as BaristaConversation),
    }
  }

  async get(id: Id, params?: Params & { user?: SlimUser }): Promise<BaristaConversationWithHistory> {
    const userId = requireUserId(params?.user)
    let record = await this.model.findOne({ where: { baristaSessionId: id, userId } })

    if (!record) {
      const claimedByOther = await this.model.findOne({ where: { baristaSessionId: id } })

      if (claimedByOther) {
        throw new NotFound(`Conversation '${id}' not found`)
      }

      if (!this.historyUrl) {
        throw new NotFound(`Conversation '${id}' not found`)
      }

      const history = await fetchHistory(this.historyUrl, id.toString()).catch(() => null)
      if (!history?.messages?.length) {
        throw new NotFound(`Conversation '${id}' not found`)
      }

      const titleMessage = history.messages.find(m => m.suggestedConversationTitle != null)
      const rawTitle = titleMessage?.suggestedConversationTitle
      const label = rawTitle != null ? rawTitle.replace(/^["']|["']$/g, '') : 'Undefined'

      const now = new Date()
      record = await this.model.create({ baristaSessionId: id.toString(), label, userId, dateCreated: now, dateLastModified: now })
      return { ...(record.toJSON() as BaristaConversation), messages: history.messages }
    }

    if (!this.historyUrl) {
      return { ...(record.toJSON() as BaristaConversation), messages: [] }
    }

    const { messages } = await fetchHistory(this.historyUrl, record.baristaSessionId)
    return { ...(record.toJSON() as BaristaConversation), messages: messages ?? [] }
  }

  async patch(baristaSessionId: Id, data: PatchData, params?: Params & { user?: SlimUser }): Promise<BaristaConversation> {
    const userId = requireUserId(params?.user)
    const { label } = data

    if (!label?.trim()) {
      throw new BadRequest('label is required')
    }

    const record = await this.model.findOne({ where: { baristaSessionId, userId } })
    if (!record) {
      throw new NotFound(`Conversation for session '${baristaSessionId}' not found`)
    }

    await record.update({ label })
    return record.toJSON() as BaristaConversation
  }

  async remove(baristaSessionId: Id, params?: Params & { user?: SlimUser }): Promise<BaristaConversation> {
    const userId = requireUserId(params?.user)

    const record = await this.model.findOne({ where: { baristaSessionId, userId } })
    if (!record) {
      throw new NotFound(`Conversation for session '${baristaSessionId}' not found`)
    }

    await record.destroy()
    return record.toJSON() as BaristaConversation
  }
}
