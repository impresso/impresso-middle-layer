import { DataProvider } from '../models/generated/schemas'
import { DataProvider as DataProviderPublic } from '../models/generated/schemasPublic'

export const transformDataProvider = (input: DataProvider): DataProviderPublic => {
  const { id, name, names } = input
  return {
    id,
    name,
    names,
  }
}
