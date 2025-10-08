import { Params } from '@feathersjs/feathers'

import { ClientService } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'
import { NewspaperIssue } from '../../models/generated/schemas'
import { FindResponse } from '../../models/common'
import initSequelizeService, { Service as SequelizeService } from '../sequelize.service'

import { SimpleSolrClient } from '../../internalServices/simpleSolr'
import { findAllRequestAdapter, findRequestAdapter } from '../../util/solr/adapters'
import { NotFound } from '@feathersjs/errors'
import Page from '../../models/pages.model'
import { measureTime } from '../../util/instruments'

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

  async find(params?: { query?: Params['query'] }): Promise<FindResponse<NewspaperIssue>> {
    const request = findAllRequestAdapter({
      ...params?.query,
      fl: ['meta_date_dt', 'meta_year_i'],
      collapse_by: 'meta_issue_id_s',
      // get first ARTICLE result
      collapse_fn: "sort='page_id_ss ASC'",
    })

    const solrResult = await this.solr.select<any>(this.solr.namespaces.Search, {
      body: request,
    })

    return {
      data: [],
      limit: 0,
      offset: 0,
      total: 0,
    }
  }

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

export default function (options: { app: ImpressoApplication }): IIssueService {
  return new IssueService(options)
}
