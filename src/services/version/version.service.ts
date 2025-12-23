import debug from 'debug'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { docs } from '@/services/version/version.schema.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import { transformVersionDetails } from '@/transformers/version.js'
import { VersionDetails } from '@/models/generated/schemas.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const log = debug('impresso/services:version')
import { getFirstAndLastDocumentDates } from '@/services/version/logic.js'

interface PartnerInstitutionDirectoryEntry {
  partner_institution_id: string
  partner_institution_names: { lang: string; name: string }[]
  partner_bitmap_index: number
}

const toPartnerInstitutions = (entries: PartnerInstitutionDirectoryEntry[]): VersionDetails['partnerInstitutions'] => {
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
  // Read partner institution directory into memory
  const partnerInstitutionDirectoryPath = path.resolve(__dirname, 'resources', 'partner_institutions_directory.json')
  let partnerInstitutionDirectory: PartnerInstitutionDirectoryEntry[] = []

  try {
    const fileContent = fs.readFileSync(partnerInstitutionDirectoryPath, 'utf8')
    partnerInstitutionDirectory = JSON.parse(fileContent) as PartnerInstitutionDirectoryEntry[]
    log(`Loaded partner institution directory with ${partnerInstitutionDirectory.length} entries`)
  } catch (e) {
    const error = e as Error
    log(`Error loading partner institution directory: ${error.message}`)
  }

  // Initialize our service with any options it requires
  app.use(
    '/version',
    {
      async find() {
        const sequelizeConfig = app.get('sequelize')
        const solr = app.service('simpleSolrClient')
        const isPublicApi = app.get('isPublicApi')
        const [firstDate, lastDate] = await getFirstAndLastDocumentDates(solr)
        log('branch:', process.env.GIT_BRANCH, 'revision:', process.env.GIT_REVISION, 'version:', process.env.GIT_TAG)
        const mediaSources = app.service('media-sources')
        const lookup = await mediaSources.getLookup()
        const response: VersionDetails = {
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
          partnerInstitutions: toPartnerInstitutions(partnerInstitutionDirectory),
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
