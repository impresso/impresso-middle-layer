import { loadYamlFile } from '../../util/yaml'
import {
  RedactionPolicy,
  redactResponse,
  redactResponseDataItem,
  webAppExploreRedactionCondition,
} from '../../hooks/redaction'
import { HookContext } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'

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

export const imageRedactionPolicyWebApp: RedactionPolicy = loadYamlFile(
  `${__dirname}/resources/imageRedactionPolicyWebApp.yml`
)

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
    console.log(context.result.data)
  }
}

export default {
  before: {
    all: [
      // authenticate('jwt')
    ],
    find: [
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
        similarTo: {
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
      redactResponseDataItem(imageRedactionPolicyWebApp, webAppExploreRedactionCondition),
    ],
    get: [redactResponse(imageRedactionPolicyWebApp, webAppExploreRedactionCondition)],
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
