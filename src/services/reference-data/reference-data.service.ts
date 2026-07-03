import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import type { NextFunction, Request, Response } from 'express'
import { DataProviders } from '@/services/data-providers/data-providers.class.js'
import { MediaSources } from '@/services/media-sources/media-sources.class.js'
import { getPartnerInstitutionsDirectory } from '@/internalServices/partnerInstitutionsDirectory.js'
import {
  contentItemTypesCsvRowLoader,
  CsvExportService,
  newDataProvidersCsvRowLoader,
  newDataSourcesCsvRowLoader,
} from '@/services/reference-data/reference-data.class.js'
import {
  getContentItemTypesCsvDocs,
  getDataProvidersCsvDocs,
  getDataSourcesCsvDocs,
} from '@/services/reference-data/reference-data.schema.js'

const sendCsvResponse = (_req: Request, res: Response, next: NextFunction) => {
  if (res.data == null) return next()

  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.send(String(res.data))
}

const registerCsvExport = (
  app: ImpressoApplication,
  path: string,
  service: CsvExportService,
  docs: ReturnType<typeof getDataProvidersCsvDocs>
) => {
  app.use(path, service, {
    methods: ['find'],
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
    express: {
      after: [sendCsvResponse],
    },
  } as ServiceOptions)
}

export default (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi') ?? false
  if (!isPublicApi) return

  const dataProviders = new DataProviders(() => getPartnerInstitutionsDirectory(app))
  const mediaSources = new MediaSources(app.get('cacheManager'))

  const dataProvidersCsvService = new CsvExportService(newDataProvidersCsvRowLoader(dataProviders))
  const dataSourcesCsvService = new CsvExportService(newDataSourcesCsvRowLoader(mediaSources))
  const contentItemTypesCsvService = new CsvExportService(contentItemTypesCsvRowLoader)

  registerCsvExport(app, '/reference-data/data-providers.csv', dataProvidersCsvService, getDataProvidersCsvDocs())
  registerCsvExport(app, '/reference-data/data-sources.csv', dataSourcesCsvService, getDataSourcesCsvDocs())
  registerCsvExport(
    app,
    '/reference-data/content-item-types.csv',
    contentItemTypesCsvService,
    getContentItemTypesCsvDocs()
  )
}
