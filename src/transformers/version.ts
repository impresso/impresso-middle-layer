import { VersionDetails, FullVersionDetails } from '@/models/generated/app/responses.js'

export const transformVersionDetails = (input: FullVersionDetails): VersionDetails => {
  return {
    version: input.version,
  }
}
