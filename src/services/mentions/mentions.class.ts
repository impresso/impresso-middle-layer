import { Params } from '@feathersjs/feathers'
import Debug from 'debug'
import { Op } from 'sequelize'
import { ImpressoApplication } from '../../types'
import { measureTime } from '../../util/instruments'
import { Service as SequelizeService } from '../sequelize.service'
import { ContentItem, EntityMention } from '../../models/generated/schemas'
import { toTextWrap } from '../../helpers'
import { groupBy } from '../../util/fn'
import { filtersToQueryAndVariables } from '../../util/solr'

const debug = Debug('impresso/services:mentions')

interface ServiceOptions {
  app: ImpressoApplication
}

interface FindParams extends Params {
  query: {
    faster?: boolean
  }
  sanitized: {
    sequelizeQuery?: any
  }
  isSafe?: boolean
}

export class Service {
  app!: ImpressoApplication
  sequelizeService!: SequelizeService

  constructor({ app }: ServiceOptions) {
    this.app = app
    this.sequelizeService = new SequelizeService({
      app: app as any,
      name: 'entity-mentions',
    })
  }

  async find(params: FindParams) {
    const where: Record<string, any> = {}

    const findAllOnly = params.query.faster || !params.sanitized.sequelizeQuery
    if (params.sanitized.sequelizeQuery) {
      where[Op.and as any] = params.sanitized.sequelizeQuery
    }
    debug(`[find] with params.isSafe:${params.isSafe} and params.query:`, params.query, findAllOnly)
    return measureTime(
      () =>
        this.sequelizeService
          .find({
            ...params,
            findAllOnly,
            where,
          })
          .then(async res => {
            debug('[find] success! total:', res.total)
            res.data = await this._enrichEntityMentions(res.data as EntityMention[])
            return res
          }),
      'mentions.find.db.mentions'
    )
  }

  async get(id: string, params?: Params) {
    return measureTime(
      () => this.sequelizeService.get(id, params).then(result => result.toJSON()),
      'mentions.get.db.mention'
    )
  }

  async _enrichEntityMentions(mentions: EntityMention[]): Promise<EntityMention[]> {
    const contentItemsIds = new Set(mentions.map(d => d.ciId))

    const queryAndVars = filtersToQueryAndVariables([
      {
        type: 'uid',
        q: [...contentItemsIds],
      },
    ])

    const contentItems = await this.app.service('content-items').findInternal({
      query: {
        sq: queryAndVars.query,
      },
    })
    const contentItemsLookup = groupBy(contentItems.data, d => d.id)

    return mentions.map(mention => {
      const contentItems = contentItemsLookup[mention.ciId]
      const contentItem = contentItems?.[0]
      if (contentItem == null) return mention

      return {
        ...mention,
        contentItem: contentItem as ContentItem,
        context: toTextWrap({
          text: contentItem.text?.content ?? '',
          l: mention.l,
          r: mention.r,
          ref: `highlight ${mention.type} uid-${mention.entityId}`,
          d: 50,
        }),
      }
    })
  }
}

export default function (options: ServiceOptions): Service {
  return new Service(options)
}
