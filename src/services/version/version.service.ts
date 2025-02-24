import debug from 'debug'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { docs } from './version.schema'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import { transformVersionDetails } from '../../transformers/version'
import { VersionDetails } from '../../models/generated/schemas'

const log = debug('impresso/services:version')
const { getFirstAndLastDocumentDates } = require('./logic')

module.exports = function (app: ImpressoApplication) {
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
