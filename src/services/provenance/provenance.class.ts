import { Unprocessable } from '@feathersjs/errors'
import type { Params } from '@feathersjs/feathers'
import type { ImpressoApplication } from '@/types.js'
import type { ProvenanceVerificationRequest } from '@/models/generated/app/requests.js'
import { newAjvInstance, validated } from '@/util/json.js'
import { csvIdsHash, hashIds, verifyReceipt, type IdDigest, type VerificationResult } from '@/util/provenance.js'

export const Limits = {
  token: 16 * 1024,
  ids: 100000,
  id: 4096,
  csvBytes: 1024 * 1024,
  bodyBytes: 2 * 1024 * 1024,
}

const requestSchemaId = 'provenance-verification-request'
const validationInstance = newAjvInstance(
  [['schema/app/requests/ProvenanceVerificationRequest.json', requestSchemaId]],
  // The oneOf branches require properties declared on the enclosing object schema.
  { strictRequired: false }
)

function parseInput(data: ProvenanceVerificationRequest): ProvenanceVerificationRequest {
  try {
    const input = validated<ProvenanceVerificationRequest>(data, requestSchemaId, validationInstance)

    // AJV counts Unicode characters; retain the limits on JavaScript string length too.
    if (input.token.length > Limits.token) {
      throw new Error('A receipt token is required (maximum 16 KiB)')
    }

    if (input.ids?.some(id => id.length > Limits.id)) {
      throw new Error('Invalid ids array or ID size limit exceeded')
    }

    return input
  } catch (error) {
    throw new Unprocessable(error instanceof Error ? error.message : 'Invalid verification input')
  }
}

async function readIdDigest(data: ProvenanceVerificationRequest): Promise<IdDigest | undefined> {
  try {
    if (data.ids !== undefined) {
      return hashIds(data.ids)
    }

    if (data.csv !== undefined) {
      const { csv } = data

      if (Buffer.byteLength(csv, 'utf8') > Limits.csvBytes) {
        throw new Error('CSV must be a string of at most 1 MiB')
      }

      return await csvIdsHash(csv)
    }

    if (data.idsHash !== undefined) {
      const { idsHash, idsCount } = data

      if (idsCount === undefined || !Number.isSafeInteger(idsCount)) {
        throw new Error('idsHash requires a lowercase SHA-256 digest and nonnegative integer idsCount')
      }

      return { idsHash, idsCount }
    }

    return undefined
  } catch (error) {
    throw new Unprocessable(error instanceof Error ? error.message : 'Invalid ID material')
  }
}

export class ProvenanceService {
  constructor(private readonly app: Pick<ImpressoApplication, 'get'>) {}

  async create(data: ProvenanceVerificationRequest, _params?: Params): Promise<VerificationResult> {
    const input = parseInput(data)

    const digest = await readIdDigest(input)
    const result = verifyReceipt(input.token, this.app)

    if (result.valid && digest) {
      result.idsMatch = result.claims.idsHash === digest.idsHash && result.claims.idsCount === digest.idsCount
    }

    return result
  }
}
