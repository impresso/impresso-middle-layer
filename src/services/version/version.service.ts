import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { getLogger } from '@/logger.js'
import { docs } from '@/services/version/version.schema.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import { transformVersionDetails } from '@/transformers/version.js'
import { FullVersionDetails } from '@/models/generated/app/responses.js'
import { getFirstAndLastDocumentDates } from '@/services/version/logic.js'
import { getPartnerInstitutionsDirectory } from '@/internalServices/partnerInstitutionsDirectory.js'
import type { PartnerInstitutionDirectoryEntry } from '@/internalServices/partnerInstitutionsDirectory.js'

const logger = getLogger(['impresso', 'services', 'version'])

const toPartnerInstitutions = (
  entries: PartnerInstitutionDirectoryEntry[]
): FullVersionDetails['partnerInstitutions'] => {
  return entries.map(entry => ({
    id: entry.partner_institution_id,
    names: entry.partner_institution_names.map(curr => {
      return {
        langCode: curr.lang,
        name: curr.name,
      }
    }),
    bitmapIndex: entry.partner_bitmap_index,
  }))
}

export default function (app: ImpressoApplication) {
  // Initialize our service with any options it requires
  app.use(
    '/version',
    {
      async find() {
        const sequelizeConfig = app.get('sequelize')
        const solr = app.service('simpleSolrClient')
        const isPublicApi = app.get('isPublicApi')
        const [firstDate, lastDate] = await getFirstAndLastDocumentDates(solr)
        logger.debug(`branch: ${process.env.GIT_BRANCH} revision: ${process.env.GIT_REVISION} version: ${process.env.GIT_TAG}`)
        const mediaSources = app.service('media-sources')
        const lookup = await mediaSources.getLookup()
        const response: FullVersionDetails = {
          solr: {
            endpoints: {},
          },
          mysql: {
            endpoint: sequelizeConfig.alias,
          },
          version: app.get('authentication')?.jwtOptions?.issuer ?? '',
          apiVersion: {
            branch: process.env.GIT_BRANCH || 'N/A',
            revision: process.env.GIT_REVISION || 'N/A',
            version: process.env.GIT_TAG || 'N/A',
          },
          documentsDateSpan: { firstDate, lastDate },
          newspapers: lookup as Record<string, Record<string, any>>,
          features: (app.get('features') ?? {}) as Record<string, Record<string, any>>,
          partnerInstitutions: toPartnerInstitutions(getPartnerInstitutionsDirectory(app)),
        }

        if (isPublicApi) {
          return transformVersionDetails(response)
        }
        return response
      },
    },
    {
      events: [],
      docs: createSwaggerServiceOptions({ schemas: {}, docs }),
    } as ServiceOptions
  )
}
