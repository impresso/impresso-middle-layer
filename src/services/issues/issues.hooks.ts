import { Hook, HookContext } from '@feathersjs/feathers'
import { obfuscate } from '../../hooks/access-rights'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { queryWithCommonParams, utils, validate, validateEach } from '../../hooks/params'
import { filtersToSolrQuery } from '../../hooks/search'
import { ImpressoApplication } from '../../types'

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

  const proxyConfig = context.app.get('proxy')
  const prefixes = proxyConfig?.localPrefixes
  const host = proxyConfig?.host

  if (prefixes != null && prefixes.length > 0 && host != null) {
    context.result?.pages?.forEach((page: Record<string, any>) => {
      const iiifPrefix = getPrefix(prefixes, page.iiif)
      if (iiifPrefix != null) {
        page.iiif = page.iiif.replace(iiifPrefix, host)
      }

      const iiifThumbnailPrefix = getPrefix(prefixes, page.iiifThumbnail)
      if (iiifThumbnailPrefix != null) {
        page.iiif = page.iiif.replace(iiifThumbnailPrefix, host)
      }
    })
  }
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
