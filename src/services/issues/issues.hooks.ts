import { Hook, HookContext } from '@feathersjs/feathers'
import { obfuscate } from '../../hooks/access-rights'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { queryWithCommonParams, utils, validate, validateEach } from '../../hooks/params'
import { filtersToSolrQuery } from '../../hooks/search'
import { ImpressoApplication } from '../../types'
import { sanitizeIiifImageUrl } from '../../util/iiif'

const getPrefix = (prefixes: string[], url?: string): string | undefined => {
  return url == null ? undefined : prefixes.find(prefix => url.startsWith(prefix))
}

/**
 * A hook used in development environment to update the IIIF URLs in pages to
 * point to the local server.
 * The prefixes to match are defined in the `localPrefixes` configuration key.
 */
const updateIiifUrls = (context: HookContext<ImpressoApplication>) => {
  if (context.type !== 'after') {
    throw new Error('The updateIiifUrls hook should be used as an after hook only')
  }

  const rewriteRules = context.app.get('images').rewriteRules

  context.result?.pages?.forEach((page: Record<string, any>) => {
    page.iiif = sanitizeIiifImageUrl(page.iiif, rewriteRules ?? [])
    page.iiifThumbnail = sanitizeIiifImageUrl(page.iiifThumbnail, rewriteRules ?? [])
  })
}

const hooks: { [key: string]: Hook } = {}

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
  before: {
    all: [],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        order_by: utils.orderBy({
          values: {
            name: 'meta_issue_id_s ASC',
            '-name': 'meta_issue_id_s DESC',
            date: 'meta_date_dt ASC',
            '-date': 'meta_date_dt DESC',
            relevance: 'score ASC',
            '-relevance': 'score DESC',
          },
          defaultValue: 'name',
        }),
      }),
      validateEach(
        'filters',
        {
          context: {
            choices: ['include', 'exclude'],
            defaultValue: 'include',
          },
          type: {
            choices: ['newspaper'],
            required: true,
          },
          q: {
            required: false,
            min_length: 2,
            max_length: 500,
          },
        },
        {
          required: false,
        }
      ),

      filtersToSolrQuery(),
      queryWithCommonParams(),
    ],
  },

  after: {
    find: [],
    get: [
      // change count_pages
      obfuscate(),
      updateIiifUrls,
    ],
  },
}
