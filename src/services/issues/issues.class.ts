import { ClientService } from '@feathersjs/feathers'
import { ImpressoApplication } from '@/types.js'
import { NewspaperIssue } from '@/models/generated/schemas.js'
import { FindResponse } from '@/models/common.js'
import initSequelizeService, { Service as SequelizeService } from '@/services/sequelize.service.js'

import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { findAllRequestAdapter, findRequestAdapter } from '@/util/solr/adapters.js'
import { NotFound } from '@feathersjs/errors'
import Page from '@/models/pages.model.js'
import { measureTime } from '@/util/instruments.js'
import { FindParams } from '@/services/content-items/content-items.class.js'

const CoversQuery = `
SELECT id as uid,
  issue_id as issue_uid,
  iiif_manifest as iiif,
  page_number as num,
  has_converted_coordinates as hasCoords,
  has_corrupted_json as hasErrors
FROM pages WHERE id IN (:pageUids)`

const IssuePagesQuery = `
SELECT
  pages.id as uid, pages.iiif_manifest as iiif, pages.page_number as num,
  pages.has_converted_coordinates as hasCoords,
  issues.access_rights as accessRights
FROM pages
  JOIN issues
    ON pages.issue_id = issues.id
WHERE issues.id = :id `

export type IIssueService = Pick<
  ClientService<NewspaperIssue, unknown, unknown, FindResponse<NewspaperIssue>>,
  'find' | 'get'
>

export class IssueService implements IIssueService {
  app: ImpressoApplication
  dbService: SequelizeService

  constructor({ app }: { app: ImpressoApplication }) {
    this.app = app
    this.dbService = initSequelizeService({
      app,
      name: 'issues',
      cacheReads: true,
    })
  }

  get solr(): SimpleSolrClient {
    return this.app?.service('simpleSolrClient')!
  }

  async getCoverIndex(pageUids: string[]): Promise<Record<string, Page>> {
    return await measureTime(
      () =>
        this.dbService
          .rawSelect({
            query: CoversQuery,
            replacements: {
              pageUids,
            },
          })
          .then(covers =>
            covers.reduce(
              (
                acc: Record<string, Page>,
                cover: {
                  uid: string
                  issue_uid: string
                  iiif: string
                  num: number
                  hasCoords: boolean
                  hasErrors: boolean
                }
              ) => {
                acc[cover.uid] = new Page(cover)
                return acc
              },
              {}
            )
          ),
      'issues.find.db.get_pages'
    )
  }

  async find(params: FindParams): Promise<FindResponse<NewspaperIssue>> {
    // load covers using content items and matching issues  ids
    const request = findRequestAdapter({
      ...params,
      fl: ['meta_issue_id_s', 'meta_date_dt', 'meta_year_i', 'page_id_ss'],
    })
    const solrResult = await this.solr.select<any>(this.solr.namespaces.Search, {
      body: {
        ...request,
        fields: ['meta_issue_id_s', 'meta_date_dt', 'meta_year_i', 'page_id_ss'].join(','),
        params: {
          ...request.params,
          ...((params.query as any)?.['sv'] ?? {}),
          params: {
            // In Solr's JSON API, the {!collapse} query parser
            // should be in the params section as a fq (filter query),
            // not in the `filter` field.
            fq: '{!collapse field=meta_issue_id_s}',
          },
        },
        query: `${request.query} AND front_b:true`,
      },
    })
    if (solrResult.response?.numFound === 0) {
      return {
        data: [],
        limit: request.limit ?? 10,
        offset: 0,
        total: 0,
      }
    }

    const pageIds = solrResult.response!.docs.reduce<string[]>((acc, doc) => {
      const ids = doc.page_id_ss ?? []
      return acc.concat(ids)
    }, [])

    const covers = await this.getCoverIndex(pageIds ?? [])

    return {
      data: solrResult.response!.docs.map(doc => {
        const issueId = doc['meta_issue_id_s']
        return {
          uid: issueId,
          labels: [],
          fresh: false,
          accessRights: 'unknown',
          pages: [],
          frontPage: covers[doc.page_id_ss?.[0]] ?? undefined,
          cover: covers[doc.page_id_ss?.[0]]?.iiif ?? '',
          year: doc['meta_year_i'],
          date: doc['meta_date_dt'],
        }
      }),
      offset: solrResult.response?.start ?? 0,
      limit: request.limit ?? 10,
      total: solrResult.response?.numFound ?? 0,
    }
  }

  /**
   * Retrieves a single newspaper issue by its unique identifier, including its metadata and associated pages.
   * Counts all content items linked to the issue.
   *
   * @param id - The unique identifier of the newspaper issue.
   * @returns A promise that resolves to the requested {@link NewspaperIssue}.
   * @throws NotFound if no issue is found for the given id.
   */
  async get(id: string): Promise<NewspaperIssue> {
    const request = findAllRequestAdapter({
      q: `meta_issue_id_s:${id}`,
      limit: 1,
      fl: ['meta_date_dt', 'meta_year_i'],
    })

    const solrResult = await this.solr.select<any>(this.solr.namespaces.Search, {
      body: request,
    })
    // continue only if we found at least one document for the requested issue id
    if (solrResult.response?.numFound === 0) {
      throw new NotFound()
    }

    const pages = await this.dbService
      .rawSelect({
        query: IssuePagesQuery,
        replacements: {
          id,
        },
      })
      .then(pages => pages.map((d: any) => new Page(d)))

    const doc = solrResult.response?.docs[0]
    return {
      uid: id,
      cover: '',
      labels: [],
      fresh: false,
      accessRights: 'unknown',
      pages,
      year: doc['meta_year_i'],
      date: doc['meta_date_dt'],
      countContentItems: solrResult.response?.numFound || 0,
    } as NewspaperIssue
  }
}

export default async function (options: { app: ImpressoApplication }): Promise<IIssueService> {
  return new IssueService(options)
}
