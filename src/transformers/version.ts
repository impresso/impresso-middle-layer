import { VersionDetails } from '@/models/generated/app/responses.js'
import { VersionDetails as VersionDetailsPublic } from '@/models/generated/schemasPublic.js'

export const transformVersionDetails = (input: VersionDetails): VersionDetailsPublic => {
  return {
    version: input.version,
  }
}
