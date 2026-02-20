import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import type { NextFunction, Request, Response } from 'express'
import { DataProviders } from '@/services/data-providers/data-providers.class.js'
import { MediaSources } from '@/services/media-sources/media-sources.class.js'
import {
  CsvExportService,
  mapDataProvidersToCsvRows,
  mapMediaSourcesToCsvRows,
} from '@/services/csv-exports/csv-exports.class.js'
import { getDataProvidersCsvDocs, getDataSourcesCsvDocs } from '@/services/csv-exports/csv-exports.schema.js'

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

  const dataProviders = new DataProviders()
  const mediaSources = new MediaSources(app.get('cacheManager'))

  const dataProvidersCsvService = new CsvExportService(async () => {
    const result = await dataProviders.find({
      query: {
        limit: Number.MAX_SAFE_INTEGER,
        offset: 0,
      },
    })

    return mapDataProvidersToCsvRows(result.data)
  })

  const dataSourcesCsvService = new CsvExportService(async () => {
    const result = await mediaSources.findMediaSources({
      limit: Number.MAX_SAFE_INTEGER,
      offset: 0,
      order_by: 'name',
    })

    return mapMediaSourcesToCsvRows(result.data)
  })

  registerCsvExport(app, '/csv-exports/data-providers.csv', dataProvidersCsvService, getDataProvidersCsvDocs())
  registerCsvExport(app, '/csv-exports/data-sources.csv', dataSourcesCsvService, getDataSourcesCsvDocs())
}
