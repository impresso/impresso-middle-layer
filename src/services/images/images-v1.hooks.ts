/**
 * @deprecated This file will be removed once we switch to the new Solr.
 */
import { loadYamlFile } from '../../util/yaml'
import {
  RedactionPolicy,
  redactResponse,
  redactResponseDataItem,
  webAppExploreRedactionCondition,
} from '../../hooks/redaction'
import { HookContext } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'
import { Image } from '../../models/generated/schemas'
import { protobuf } from 'impresso-jscommons'
import { BadRequest } from '@feathersjs/errors'

// const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  utils,
  validate,
  validateEach,
  queryWithCommonParams,
  displayQueryParams,
  REGEX_UID,
} = require('../../hooks/params')
const { qToSolrFilter, filtersToSolrQuery } = require('../../hooks/search')

const { resolveFacets, resolveQueryComponents } = require('../../hooks/search-info')

const { eachFilterValidator } = require('../search/search.validators')

export const imageRedactionPolicy: RedactionPolicy = loadYamlFile(`${__dirname}/resources/imageRedactionPolicy.yml`)

const getPrefix = (prefixes: string[], url?: string): string | undefined => {
  return url == null ? undefined : prefixes.find(prefix => url.startsWith(prefix))
}

/**
 * A hook used in development environment to update the IIIF URLs in images to
 * point to the local server.
 * The prefixes to match are defined in the `localPrefixes` configuration key.
 */
const updateIiifUrls = (context: HookContext<ImpressoApplication>) => {
  if (context.type !== 'after') {
    throw new Error('The updateIiifUrls hook should be used as an after hook only')
  }

  const proxyConfig = context.app.get('proxy')
  const prefixes = proxyConfig?.localPrefixes
  const host = proxyConfig?.host

  const replaceableItems = ['pages', 'regions']
  const replaceableFields = ['iiif', 'iiifThumbnail', 'iiifFragment']

  if (prefixes != null && prefixes.length > 0 && host != null) {
    context.result?.data?.forEach((image: Record<string, any>) => {
      replaceableItems.forEach((key: string) => {
        image?.[key]?.forEach((item: Record<string, any>) => {
          replaceableFields.forEach((field: string) => {
            const iiifPrefix = getPrefix(prefixes, item[field])
            if (iiifPrefix != null) {
              item[field] = item[field].replace(iiifPrefix, host)
            }
          })
        })
      })
    })
  }
}

const toNewImageFormat = (image?: Record<string, any>): Image | undefined => {
  if (image == null) return undefined
  return {
    uid: image.uid,
    issueUid: image.issue?.uid,
    previewUrl: image?.regions?.[0]?.iiifFragment,
    date: image.date,
    caption: (image.title ?? '') != '' ? image.title : undefined,
    pageNumbers: image.pages?.map((p: any) => p.num),
    contentItemUid: image.article,
    mediaSourceRef: {
      uid: image.newspaper?.uid,
      name: image.newspaper?.title,
      type: 'newspaper',
    },
  }
}

const convertItemsToNewImageFormat = (context: HookContext<ImpressoApplication>) => {
  if (context.type !== 'after') {
    throw new Error('The updateIiifUrls hook should be used as an after hook only')
  }

  const newResult = {
    ...context.result,
    data: context.result?.data?.map(toNewImageFormat),
    pagination: {
      total: context.result?.total,
      limit: context.result?.limit,
      offset: context.result?.offset,
    },
  }
  context.result = newResult
}

const convertItemToNewImageFormat = (context: HookContext<ImpressoApplication>) => {
  if (context.type !== 'after') {
    throw new Error('The updateIiifUrls hook should be used as an after hook only')
  }
  const newResult = toNewImageFormat(context.result)

  context.result = newResult
}

const deserializeFilters = (serializedFilters: string) => {
  if (serializedFilters == null) return []
  try {
    return protobuf.searchQuery.deserialize(serializedFilters).filters || []
  } catch (error) {
    throw new BadRequest(`Could not deserialize filters: ${(error as Error).message}`)
  }
}

// parse filters
const parseFiltersHook = (context: HookContext<ImpressoApplication>) => {
  const { filters } = context.params?.query ?? {}
  context.params.query.filters = deserializeFilters(filters)
  console.log('ooo', context.params.query.filters)
}

const parseQ = (context: HookContext<ImpressoApplication>) => {
  if (context?.params?.query?.term) {
    context.params.query.q = context.params.query.term
  }
}

export default {
  before: {
    all: [
      // authenticate('jwt')
    ],
    find: [
      parseFiltersHook,
      parseQ,
      validate({
        order_by: utils.orderBy({
          values: {
            random: 'random',
            id: 'id ASC',
            '-id': 'id DESC',
            relevance: 'score ASC',
            '-relevance': 'score DESC',
            date: 'meta_date_dt ASC',
            '-date': 'meta_date_dt DESC',
          },
          defaultValue: 'id',
        }),
        similar_to_image_id: {
          regex: REGEX_UID,
          required: false,
        },
        similarToUploaded: {
          regex: REGEX_UID,
          required: false,
        },
        vectorType: {
          values: ['InceptionResNetV2', 'ResNet50'],
          defaultValue: 'ResNet50',
        },
        randomPage: {
          required: false,
          transform: (d: string) => ['true', ''].includes(d),
        },
        facets: utils.facets({
          values: {
            year: {
              type: 'terms',
              field: 'meta_year_i',
              mincount: 1,
              limit: 400,
            },
            newspaper: {
              type: 'terms',
              field: 'meta_journal_s',
              mincount: 1,
              limit: 20,
              numBuckets: true,
            },
            date: {
              type: 'terms',
              field: 'meta_date_dt',
              mincount: 1,
              limit: 100,
            },
          },
        }),
      }),
      validateEach('filters', eachFilterValidator, {
        required: false,
      }),
      qToSolrFilter('string'),
      filtersToSolrQuery(),
      queryWithCommonParams(),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      resolveFacets(),
      displayQueryParams(['queryComponents', 'filters']),
      resolveQueryComponents(),
      updateIiifUrls,
      convertItemsToNewImageFormat,
      redactResponseDataItem(imageRedactionPolicy, webAppExploreRedactionCondition),
    ],
    get: [convertItemToNewImageFormat, redactResponse(imageRedactionPolicy, webAppExploreRedactionCondition)],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
}
