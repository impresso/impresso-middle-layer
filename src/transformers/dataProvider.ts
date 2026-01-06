import { DataProvider } from '@/models/generated/schemas.js'
import { DataProvider as DataProviderPublic } from '@/models/generated/schemasPublic.js'

export const transformDataProvider = (input: DataProvider): DataProviderPublic => {
  const { id, name, names } = input
  return {
    id,
    name,
    names,
  }
}
