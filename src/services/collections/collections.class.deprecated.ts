/* eslint-disable no-unused-vars */
import { BadGateway } from '@feathersjs/errors'
import debugLib from 'debug'
import { identity, pick } from 'lodash'
import { Op } from 'sequelize'
import Collection, { STATUS_DELETED, STATUS_PUBLIC, STATUS_SHARED } from '../../models/collections.model'

import { Params } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'
import { measureTime } from '../../util/instruments.js'
import { Service as SequelizeService } from '../sequelize.service.js'
import User from '../../models/users.model'

const debug = debugLib('impresso/services:collections')

interface FindQuery {
  uids?: string[]
  q?: string
  order_by: string
}

interface WithUser {
  user?: User
}

interface CreateData {
  name: string
  description?: string
  status?: string

  sanitized: CreateData
}

export class Service {
  private app: ImpressoApplication
  private name: string
  private sequelizeService: SequelizeService

  constructor(app: ImpressoApplication) {
    this.app = app
    this.name = 'collections'
    this.sequelizeService = new SequelizeService({
      app: app as any,
      name: this.name,
    })
  }

  async find(params: Params<FindQuery> & WithUser) {
    return this._find(params)
  }

  async findInternal(params: Params<FindQuery> & WithUser) {
    return this._find(params)
  }

  async _find(params: Params<FindQuery> & WithUser) {
    const where = {
      [Op.not]: { status: STATUS_DELETED },
      [Op.and]: [
        {
          [Op.or]: [{ creatorId: params.user?.id }, { status: STATUS_PUBLIC }],
        },
      ],
    }

    if (params.query?.uids) {
      where[Op.and].push({
        uid: { [Op.in]: params.query.uids },
      } as any)
    }

    if (params.query?.q) {
      where[Op.and].push({
        [Op.or]: [{ name: params.query.q } as any, { description: params.query.q }],
      })
    }

    return measureTime(
      () =>
        this.sequelizeService.find({
          query: {
            ...params.query,
          },
          where,
        }),
      'collections.db.find'
    )
  }

  async get(id: string, params: Params<{ nameOnly?: boolean }> & WithUser) {
    const where: Record<symbol | string, any> = {
      uid: id,
    }

    if (!params.query?.nameOnly) {
      if (params.user) {
        where[Op.not] = { status: { [Op.in]: [STATUS_DELETED] } } as any
        where[Op.or] = [{ creatorId: params.user.id }, { status: { [Op.in]: [STATUS_PUBLIC, STATUS_SHARED] } }]
      } else {
        where.status = {
          [Op.in]: [STATUS_PUBLIC, STATUS_SHARED],
        }
      }
    }

    const transform = params.query?.nameOnly ? (c: any) => pick(c, ['uid', 'name', 'description']) : identity

    return measureTime(
      () =>
        this.sequelizeService
          .get(id, {
            where,
          })
          .then(collection => transform(collection.toJSON())),
      'collections.db.get'
    )
  }

  async create(data: CreateData, params: WithUser) {
    debug('[create]', data)
    const collection = new Collection({
      ...data.sanitized,
      creator: params.user as any,
    })

    return this.sequelizeService.create({
      ...collection,
      creatorId: collection.creator?.id,
    })
  }

  async patch(id: string, data: CreateData, params: WithUser) {
    // get the collection
    return this.sequelizeService.patch(
      id as any,
      data.sanitized as any,
      {
        where: {
          creatorId: params.user?.id,
        },
      } as any
    )
  }

  async remove(id: string, params: WithUser) {
    debug(`[remove] id:${id}, params.user.uid:${params.user?.uid}`)
    const result = await this.sequelizeService.patch(
      id as any,
      {
        status: STATUS_DELETED,
      } as any,
      {
        where: {
          creatorId: params.user?.id,
        },
      } as any
    )
    debug(`[remove] id:${id}, patch status to DEL. Running celery task "remove_collection"...`)

    const queueService = this.app.service('queueService')
    await queueService.removeAllCollectionItems({
      collectionId: id,
      userId: params.user?.id as any as string,
    })

    const celery = this.app.get('celeryClient')

    return celery
      ?.run({
        task: 'impresso.tasks.remove_collection',
        args: [
          // collection_uid
          id,
          // user id
          params.user?.id,
        ],
      })
      .then(res => {
        debug(`[remove] id:${id} celery task launched`, res.status)
        return {
          params: {
            id,
            status: STATUS_DELETED,
          },
          task: {
            task_id: (res as any).task_id,
            creationDate: (res as any).date_done,
          },
        }
      })
      .catch(err => {
        debug(`[remove] id:${id} celery task FAILED:`, err)
        throw new BadGateway('celeryUnreachable')
      })
  }
}
