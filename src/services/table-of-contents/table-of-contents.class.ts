/* eslint-disable no-unused-vars */
import { SearchFacet } from '@/models/search-facets.model.js'
import { findEntitiesByIds } from '@/services/entities/lookup.js'
import Newspaper from '@/models/newspapers.model.js'
import { BaseArticle, IFragmentsAndHighlights } from '@/models/articles.model.js'
import { asFindAll, FindAllParams } from '@/util/solr/adapters.js'
import { ImpressoApplication } from '@/types.js'
import { PrintContentItem } from '@/models/solr.js'

const BaseArticleTocFields = [
  'id',
  'content_length_i',
  'cc_b',
  'lg_s',
  'page_id_ss',
  'item_type_s',
  'title_txt_fr',
  'title_txt_de',
  'title_txt_en',
  'pers_entity_ids_dpfs',
  'loc_entity_ids_dpfs',
  // 'ucoll_ss',
  'snippet_plain',
]

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

  async get(id: string, params: any) {
    const newspaper = new Newspaper({
      id: id.split('-').shift(),
    })
    const highlightProps: Record<string, number | string> = {
      'hl.snippets': 0,
      'hl.alternateField': 'content_txt_fr',
      'hl.maxAlternateFieldLength': 120,
      'hl.fragsize': 0,
    }
    const languages = newspaper.languages

    if (newspaper.id === 'NZZ') {
      highlightProps['hl.alternateField'] = 'content_txt_de'
    } else if (languages.length) {
      highlightProps['hl.alternateField'] = `content_txt_${languages[0]}`
    }

    // get all articles for the give issue,
    // at least 1 of content length, max 500 articles
    const request = {
      q: `meta_issue_id_s:${id} AND filter(content_length_i:[1 TO *])`,
      facets: {
        person: {
          type: 'terms',
          field: 'pers_entity_ids_dpfs',
          mincount: 1,
          limit: 5,
          offset: 0,
          numBuckets: true,
        },
        location: {
          type: 'terms',
          field: 'loc_entity_ids_dpfs',
          mincount: 1,
          limit: 5,
          offset: 0,
          numBuckets: true,
        },
      },
      limit: 500,
      offset: 0,
      order_by: 'id ASC',
      highlight_by: 'nd',
      highlightProps,
      fl: BaseArticleTocFields,
    } satisfies FindAllParams

    // const result = await measureTime(
    //   () => this.app.get('solrClient').findAll(request, BaseArticle.solrFactory),
    //   'table-of-contents.get.solr.toc'
    // )
    const result = await asFindAll<PrintContentItem & IFragmentsAndHighlights, string, string, BaseArticle>(
      this.solr,
      'search',
      request,
      BaseArticle.solrFactory as any
    )

    // get persons and locations from the facet,
    // using the simplified version of their buckets
    const [persons, locations] = await Promise.all(
      ['person', 'location'].map(async type => {
        const t = await SearchFacet.build(
          {
            type,
            ...(result.facets?.[type] ?? ({} as any)),
          },
          this.app
        )
        return t.getItems()
      })
    )

    const entityIds = (result.response?.docs ?? []).flatMap(doc => [
      ...(doc.persons ?? []).map(person => person.id),
      ...(doc.locations ?? []).map(location => location.id),
    ])
    const entities = new Map((await findEntitiesByIds(this.app, entityIds)).map(entity => [entity.id, entity]))
    result.response?.docs.forEach(doc => {
      doc.persons = doc.persons?.map(person => {
        return {
          ...person,
          type: 'person',
          name: entities.get(person.id)?.name ?? person.id,
        }
      })

      doc.locations = doc.locations?.map(location => {
        return {
          ...location,
          type: 'location',
          name: entities.get(location.id)?.name ?? location.id,
        }
      })
    })

    // return a TOC instance without instantiating a class.
    return {
      newspaper,
      persons,
      locations,
      articles: result.response?.docs ?? [],
      countArticles: result.response?.numFound ?? 0,
      info: {
        fragments: result.fragments,
      },
    }
  }
}

export default function (options: { app: ImpressoApplication; name: string }) {
  return new Service(options)
}
