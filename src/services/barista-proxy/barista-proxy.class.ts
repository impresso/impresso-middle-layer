import { request } from 'undici'

import type { Params, ServiceMethods } from '@feathersjs/feathers'
import { BadRequest } from '@feathersjs/errors'
import { BaristaConfig } from '../../models/generated/common'

export interface BaristaRequest {
  message: string
}

export interface BaristaResponse {
  messages: any
}

export class BaristaProxy implements Pick<ServiceMethods<BaristaResponse, BaristaRequest>, 'create'> {
  private readonly config?: BaristaConfig

  constructor(config?: BaristaConfig) {
    this.config = config
  }

  async create(data: BaristaRequest, params?: Params<any>): Promise<BaristaResponse> {
    if (!this.config) {
      throw new BadRequest('Barista is not configured')
    }

    if (!data.message) {
      throw new BadRequest('Message is required')
    }

    const { statusCode, body } = await request(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: data.message,
      }),
      // throwOnError: true,
    })

    if (statusCode !== 200) {
      throw new BadRequest(`Barista returned status code ${statusCode}`)
    }

    const responseData = await body.json()
    return responseData as BaristaResponse
  }
}
