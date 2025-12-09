import type { Params, ServiceMethods } from '@feathersjs/feathers'
import { BadRequest } from '@feathersjs/errors'
import { BaristaConfig } from '../../models/generated/common'
import { IFetchClient } from '../../utils/http/client/base'
import { createFetchClient } from '../../utils/http/client'

export interface BaristaRequest {
  message: string
}

export interface BaristaResponse {
  messages: any
}

export class BaristaProxy implements Pick<ServiceMethods<BaristaResponse, BaristaRequest>, 'create'> {
  private readonly config?: BaristaConfig
  private readonly client: IFetchClient

  constructor(config?: BaristaConfig) {
    this.config = config
    this.client = createFetchClient({})
  }

  async create(data: BaristaRequest, params?: Params<any>): Promise<BaristaResponse> {
    if (!this.config) {
      throw new BadRequest('Barista is not configured')
    }

    if (!data.message) {
      throw new BadRequest('Message is required')
    }

    const response = await this.client.fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: data.message,
      }),
      // throwOnError: true,
    })

    if (response.status !== 200) {
      throw new BadRequest(`Barista returned status code ${response.status}`)
    }

    const responseData = await response.json()
    return responseData as BaristaResponse
  }
}
