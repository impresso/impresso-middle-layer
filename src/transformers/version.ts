import { VersionDetails } from '../models/generated/schemas'
import { VersionDetails as VersionDetailsPublic } from '../models/generated/schemasPublic'

export const transformVersionDetails = (input: VersionDetails): VersionDetailsPublic => {
  return {
    version: input.version,
  }
}
