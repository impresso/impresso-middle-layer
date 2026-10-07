import Entity from '@/models/entities.model.js'
import { getLogger } from '@/logger.js'
import { mediaSourceToNewspaper } from '@/services/newspapers/newspapers.class.js'
import type { SolrNamespace } from '@/solr.js'
import { SolrNamespaces } from '@/solr.js'
import { EntityTypeAliases } from '@/utils/entity.utils.js'
import { buildSearchEntitiesSolrQuery } from '@/services/entities/logic.js'
import type { EntitySolrDocumentV3 } from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'
import { getEntitySuggestionCountField } from './util.js'

import { parse as chronoParse } from 'chrono-node'
import moment from 'moment'

import { toPlainText } from '@/helpers.js'
import { NotFound } from '@feathersjs/errors'
import type { Params } from '@feathersjs/feathers'
import type { Filter } from 'impresso-jscommons'

import type { SlimUser } from '@/authentication.js'
import type { SuggestEntry } from '@/internalServices/simpleSolr.js'
import { Collection } from '@/models/generated/app/entities.js'
import { Newspaper as INewspaper } from '@/models/generated/deprecated/models.js'
import Mention from '@/models/mentions.model.js'
import {
  IDateRangeSuggestion,
  IRegexSuggestion,
  isDateRangeSuggestion,
  isSuggestion,
  ISuggestion,
  Suggestion,
} from '@/models/suggestions.model.js'
import Topic from '@/models/topics.model.js'
import type { ImpressoApplication } from '@/types.js'

const logger = getLogger(['impresso', 'services', 'suggestions'])

const MULTI_YEAR_RANGE = /^\s*(\d{4})(\s*(to|-)\s*(\d{4})\s*)?$/

interface SuggestionQuery {
  q: string
}

type SuggestionsParams = Params<SuggestionQuery> & { user?: SlimUser }

const asMentionSuggestion = (doc: SuggestEntry): ISuggestion<Mention> => {
  // payload for mention contains type only
  const item = new Mention({
    name: doc.term.replace(/<[^>]*>/g, ''),
    frequence: doc.weight,
    type: doc.payload,
  })
  return new Suggestion({
    q: item.name,
    h: doc.term,
    type: 'mention',
    item,
    weight: item.frequence,
  })
}

const asTopicSuggestion = (doc: SuggestEntry): ISuggestion<Topic> => {
  const topic = Topic.solrSuggestFactory()(doc)
  return new Suggestion({
    q: topic.id,
    h: topic.getExcerpt()?.join(' ') ?? '',
    type: 'topic',
    item: topic,
  })
}

const asRegexSuggestions = async (query: SuggestionQuery): Promise<IRegexSuggestion[]> => {
  if (query.q.indexOf('/') === 0) {
    try {
      RegExp(query.q)
    } catch (e) {
      return []
    }
    return [
      {
        type: 'regex',
        q: query.q,
        context: 'include',
      },
    ] satisfies IRegexSuggestion[]
  }
  return []
}

const asDaterangeSuggestions = async (query: SuggestionQuery): Promise<IDateRangeSuggestion[]> => {
  const myears = query.q.match(MULTI_YEAR_RANGE)

  if (myears) {
    const start = moment.utc(`${myears[1]}-01-01`).format()
    const end = moment
      .utc(myears[4] ? `${myears[4]}-12-31` : `${myears[1]}-12-31`)
      .endOf('day')
      .format()

    return [
      {
        type: 'daterange',
        context: 'include',
        daterange: `${start} TO ${end}`,
      },
    ] satisfies IDateRangeSuggestion[]
  }

  // if a date hasn't been recognized by our basic regex.
  const asdate = chronoParse(query.q)

  if (asdate.length === 0) return []

  const dateSuggestions: (IDateRangeSuggestion | undefined)[] = asdate.map(d => {
    if (!d.start) {
      return undefined
    }
    const start = moment.utc(d.start.date()).format()
    let end: string | undefined
    if (d.end?.get('day')) {
      end = moment.utc(d.end.date()).endOf('day').format()
    } else if (d.end?.get('month')) {
      end = moment.utc(d.end.date()).endOf('month').format()
    } else if (d.end?.get('year')) {
      end = moment.utc(d.end.date()).endOf('year').format()
    } else if (d.start?.get('day')) {
      end = moment.utc(d.start.date()).endOf('day').format()
    } else if (d.start?.get('month')) {
      end = moment.utc(d.start.date()).endOf('month').format()
    } else if (d.start?.get('year')) {
      end = moment.utc(d.start.date()).endOf('year').format()
    }

    if (!end) {
      return undefined
    }
    return {
      type: 'daterange' as const,
      text: d.text,
      context: 'include' as const,
      daterange: `${start} TO ${end}`,
    } satisfies IDateRangeSuggestion
  })

  return dateSuggestions.filter(isDateRangeSuggestion)
}

export class Service {
  app: ImpressoApplication
  name: string

  constructor({ app, name }: { app: ImpressoApplication; name: string }) {
    this.app = app
    this.name = name
  }

  get solr() {
    return this.app.service('simpleSolrClient')
  }

  async suggestNewspapers({ q }: { q: string }): Promise<ISuggestion<INewspaper>[]> {
    const mediaSources = await this.app.service('media-sources').findMediaSources({
      term: q,
      limit: 3,
      offset: 0,
      type: 'newspaper',
    })
    const newspapers = mediaSources.data.map(mediaSourceToNewspaper)

    return newspapers.map(d => {
      return new Suggestion<INewspaper>({
        type: 'newspaper',
        h: d.name,
        q: d.id,
        item: d,
      })
    })
  }

  async suggestCollections({ q, user }: { q: string; user?: SlimUser }): Promise<Suggestion<Collection>[]> {
    if (!user || !user.id) return Promise.resolve([])
    const collections = await this.app.service('collections').find({
      query: {
        term: q,
        limit: 3,
      },
      user,
    })

    return collections.data.map(c => {
      return new Suggestion<Collection>({
        q: c.id,
        h: c.title ?? '',
        type: 'collection',
        item: c,
      })
    })
  }

  async suggestItem<T>(
    q: string,
    type: SolrNamespace,
    builder: (doc: SuggestEntry) => Suggestion<T>
  ): Promise<Suggestion<T>[]> {
    const request = { q, count: 3 }
    const result = await this.solr.suggest(type, request)
    return (result.suggestions ?? []).map(builder)
  }

  async suggestEntities({ q, type }: { q: string; type?: string }): Promise<ISuggestion<Entity>[]> {
    if (!q.trim()) return []
    const solrType = type == null || type === 'entity' ? undefined : (EntityTypeAliases[type] ?? type)
    const countField = getEntitySuggestionCountField(solrType)
    const filters: Filter[] = [{ type: 'string', q }]
    if (solrType != null) filters.push({ type: 'type', q: solrType })
    const query = buildSearchEntitiesSolrQuery(
      {
        filters,
        limit: 3,
        offset: 0,
        orderBy: `def(${countField},0) DESC,def(mention_count_l,0) DESC,id ASC`,
      },
      this.app.get('solrConfiguration').namespaces ?? [],
      this.app.get('features') ?? {}
    )
    query.params = { ...query.params, fl: `${query.params?.fl},${countField}` }
    const result = await this.solr.select<EntitySolrDocumentV3>(SolrNamespaces.Entities, { body: query })
    return (result.response?.docs ?? []).map(doc => {
      const item = Entity.solrFactory()(doc)
      const type = item.type
      return new Suggestion({
        q: item.id,
        h: result.highlighting?.[item.id]?.entitySuggest?.[0] ?? item.name,
        type,
        item,
        weight: doc[countField] ?? 0,
      })
    })
  }

  async suggestMentions({ q }: { q: string }) {
    return await this.suggestItem(q, SolrNamespaces.Mentions, asMentionSuggestion)
  }

  async suggestTopics({ q }: { q: string }) {
    return await this.suggestItem(q, SolrNamespaces.Topics, asTopicSuggestion)
  }

  async get(type: string, params: SuggestionsParams) {
    switch (type) {
      case 'topic':
        return this.suggestTopics({
          q: toPlainText(params.query!.q),
        })
      case 'newspaper':
        return this.suggestNewspapers({
          q: toPlainText(params.query!.q),
        })
      case 'collection':
        return this.suggestCollections({
          q: toPlainText(params.query!.q),
          user: params.user,
        })
      case 'person':
      case 'location':
      case 'entity':
      case 'organization':
      case 'nag':
      case 'organisation':
      case 'newsagency':
      case 'radiostation':
        return this.suggestEntities({
          q: toPlainText(params.query!.q),
          type,
        })
      case 'mention':
        return this.suggestMentions({
          q: toPlainText(params.query!.q),
        })
      default:
        throw new NotFound()
    }
  }

  async find(params: SuggestionsParams): Promise<{ data: ISuggestion<any>[] }> {
    logger.debug(`[find] params.query.q: ${params.query?.q}`)

    const qPlainText = toPlainText(params.query!.q)

    if (!qPlainText.length) {
      return {
        data: [],
      }
    }

    const suggestionsSets = await Promise.all([
      asRegexSuggestions(params.query!),
      asDaterangeSuggestions(params.query!),
      this.suggestNewspapers({
        q: qPlainText,
      }),
      this.suggestTopics({
        q: qPlainText,
      }),
      this.suggestMentions({
        q: qPlainText,
      }),
      this.suggestEntities({
        q: qPlainText,
      }),
    ])

    return {
      data: suggestionsSets.flat().filter(isSuggestion),
    }
  }
}

export default function (options: { app: ImpressoApplication; name: string }) {
  return new Service(options)
}
