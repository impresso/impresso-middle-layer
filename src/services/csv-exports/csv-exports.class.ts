import type { Params } from '@feathersjs/feathers'
import { stringify } from 'csv-stringify/sync'
import type { DataProvider, MediaSource } from '@/models/generated/schemas.js'

export interface CsvExportRow {
  id: string
  label: string
}

export type CsvExportRowLoader = () => Promise<CsvExportRow[]>

const CsvColumns = [
  { key: 'id', header: 'id' },
  { key: 'label', header: 'label' },
] as const

export const serializeCsvRows = (rows: CsvExportRow[]): string => {
  return stringify(rows, {
    columns: CsvColumns,
    delimiter: ',',
    header: true,
  })
}

export const mapDataProvidersToCsvRows = (providers: Pick<DataProvider, 'id' | 'name'>[]): CsvExportRow[] => {
  return providers.map(provider => ({
    id: provider.id,
    label: provider.name,
  }))
}

export const mapMediaSourcesToCsvRows = (mediaSources: Pick<MediaSource, 'uid' | 'name'>[]): CsvExportRow[] => {
  return mediaSources.map(mediaSource => ({
    id: mediaSource.uid,
    label: mediaSource.name,
  }))
}

export class CsvExportService {
  constructor(private readonly loadRows: CsvExportRowLoader) {}

  async find(_params?: Params): Promise<string> {
    const rows = await this.loadRows()
    return serializeCsvRows(rows)
  }
}
