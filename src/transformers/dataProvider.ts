import { DataProvider } from '../models/generated/schemas'
import { DataProvider as DataProviderPublic } from '../models/generated/schemasPublic'

export const transformDataProvider = (input: DataProvider): DataProviderPublic => {
  return {
    id: input.id,
    names: input.names,
  }
}
