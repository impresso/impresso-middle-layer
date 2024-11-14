import debug from 'debug'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { docs } from './version.schema'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import { transformVersionDetails } from '../../transformers/version'

const log = debug('impresso/services:version')
const { getFirstAndLastDocumentDates, getNewspaperIndex } = require('./logic')

module.exports = function (app: ImpressoApplication) {
  // Initialize our service with any options it requires
  app.use(
    '/version',
    {
      async find() {
        const solrConfig = app.get('solr')
        const sequelizeConfig = app.get('sequelize')
        const solr = app.service('cachedSolr')
        const isPublicApi = app.get('isPublicApi')

        const [firstDate, lastDate] = await getFirstAndLastDocumentDates(solr)
        log('branch:', process.env.GIT_BRANCH, 'revision:', process.env.GIT_REVISION, 'version:', process.env.GIT_TAG)
        const response = {
          solr: {
            endpoints: {
              search: solrConfig.search.alias,
              mentions: solrConfig.mentions.alias,
              topics: solrConfig.topics.alias,
              images: solrConfig.images.alias,
              entities: solrConfig.entities.alias,
            },
          },
          mysql: {
            endpoint: sequelizeConfig.alias,
          },
          version: app.get('authentication').jwtOptions.issuer,
          apiVersion: {
            branch: process.env.GIT_BRANCH || 'N/A',
            revision: process.env.GIT_REVISION || 'N/A',
            version: process.env.GIT_TAG || 'N/A',
          },
          documentsDateSpan: { firstDate, lastDate },
          newspapers: await getNewspaperIndex(),
          features: app.get('features') || {},
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
