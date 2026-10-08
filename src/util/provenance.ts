import { createHash, hkdfSync, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { rename, unlink } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { parse } from 'csv-parse'
import { stringify } from 'csv-stringify'
import jwt from 'jsonwebtoken'
import type { ProvenanceConfig } from '@/models/generated/app/configuration.js'
import type { ImpressoApplication } from '@/types.js'

export const ProvenanceColumn = 'impresso:provenance'
export type ReceiptInput = {
  userRef: string
  idsHash: string
  idsCount: number
} & ({ kind: 'api'; path: string; exportId?: never } | { kind: 'export'; exportId: string; path?: never })
export type ReceiptClaims = ReceiptInput & { iss: string; aud: string; iat: number; jti: string }
export type VerificationResult =
  { valid: true; claims: ReceiptClaims; idsMatch?: boolean } | { valid: false; reason: string }
export type IdDigest = { idsHash: string; idsCount: number }
export interface ProvenanceSigningConfig {
  provenance: ProvenanceConfig
  authSecret: string
}

type KeySource = ProvenanceSigningConfig | Pick<ImpressoApplication, 'get'>

function configuration(source: KeySource): ProvenanceSigningConfig {
  if (!('get' in source)) return source

  const provenance = source.get('provenance')
  const authSecret = source.get('authentication')?.secret

  if (!provenance) throw new Error('Provenance is not configured')
  if (!nonempty(authSecret)) throw new Error('Provenance requires authentication.secret')

  return { provenance, authSecret }
}

/** Derive a separate signing key without storing additional key material. */
export function deriveProvenanceKey(authSecret: string): { secret: Buffer; kid: string } {
  if (!nonempty(authSecret)) throw new Error('Provenance requires authentication.secret')

  const secret = Buffer.from(hkdfSync('sha256', authSecret, 'impresso-middle-layer', 'provenance-watermark:v1', 32))
  const fingerprint = createHash('sha256').update(secret).digest('hex')

  return { secret, kid: `hkdf-sha256-v1-${fingerprint}` }
}

export function provenanceKeyId(source: KeySource): string {
  return deriveProvenanceKey(configuration(source).authSecret).kid
}

export function initializeProvenance(app: ImpressoApplication): void {
  const config = app.get('provenance')
  if (!config?.enabled) return
  if (
    !app.get('authentication')?.jwtOptions?.audience ||
    config.audience === app.get('authentication')?.jwtOptions?.audience ||
    config.audience === app.get('imlAuthConfiguration')?.jwtOptions?.audience
  ) {
    throw new Error('Provenance requires a distinct audience and an explicit authentication audience')
  }

  const { authSecret } = configuration(app)
  for (const secret of [authSecret, ...(config.previousAuthSecrets ?? [])]) {
    deriveProvenanceKey(secret)
  }
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
function validClaims(value: unknown): value is ReceiptClaims {
  if (typeof value !== 'object' || value === null) return false
  return (
    'iat' in value &&
    typeof value.iat === 'number' &&
    Number.isFinite(value.iat) &&
    'iss' in value &&
    nonempty(value.iss) &&
    'aud' in value &&
    nonempty(value.aud) &&
    'jti' in value &&
    nonempty(value.jti) &&
    'userRef' in value &&
    nonempty(value.userRef) &&
    'idsHash' in value &&
    typeof value.idsHash === 'string' &&
    /^[a-f0-9]{64}$/.test(value.idsHash) &&
    'idsCount' in value &&
    typeof value.idsCount === 'number' &&
    Number.isSafeInteger(value.idsCount) &&
    value.idsCount >= 0 &&
    !('exp' in value) &&
    'kind' in value &&
    ((value.kind === 'api' && 'path' in value && nonempty(value.path) && !('exportId' in value)) ||
      (value.kind === 'export' && 'exportId' in value && nonempty(value.exportId) && !('path' in value)))
  )
}

export function createReceipt(input: ReceiptInput, source: KeySource): string {
  const { provenance: config, authSecret } = configuration(source)
  const key = deriveProvenanceKey(authSecret)
  const claims = {
    ...input,
    iss: config.issuer,
    aud: config.audience,
    iat: Math.floor(Date.now() / 1000),
    jti: randomUUID(),
  }
  if (!validClaims(claims)) throw new Error('Invalid provenance claims')
  return jwt.sign(claims, key.secret, { algorithm: 'HS256', keyid: key.kid })
}

export function verifyReceipt(token: string, source: KeySource): VerificationResult {
  try {
    const { provenance: config, authSecret } = configuration(source)
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || decoded.header.alg !== 'HS256' || !nonempty(decoded.header.kid)) {
      return { valid: false, reason: 'Unsupported algorithm or unknown key ID' }
    }
    const key = [authSecret, ...(config.previousAuthSecrets ?? [])]
      .map(deriveProvenanceKey)
      .find(candidate => candidate.kid === decoded.header.kid)

    if (!key) return { valid: false, reason: 'Unsupported algorithm or unknown key ID' }

    const claims = jwt.verify(token, key.secret, {
      algorithms: ['HS256'],
      issuer: config.issuer,
      audience: config.audience,
    })
    if (!validClaims(claims) || claims.iss !== config.issuer || claims.aud !== config.audience)
      return { valid: false, reason: 'Invalid receipt claims' }
    return { valid: true, claims }
  } catch {
    return { valid: false, reason: 'Invalid receipt signature or claims' }
  }
}

export function validateId(id: unknown): asserts id is string {
  if (!nonempty(id) || /[\r\n]/.test(id)) throw new Error('IDs must be nonempty strings without CR or LF')
}

function idHasher() {
  const hash = createHash('sha256')
  let idsCount = 0
  return {
    add(id: unknown) {
      validateId(id)
      if (idsCount > 0) hash.update('\n')
      hash.update(id, 'utf8')
      idsCount++
    },
    digest(): IdDigest {
      return { idsHash: hash.digest('hex'), idsCount }
    },
  }
}
export function hashIds(ids: readonly unknown[]): IdDigest {
  const hash = idHasher()
  for (const id of ids) hash.add(id)
  return hash.digest()
}
export function idsHash(ids: readonly string[]): string {
  return hashIds(ids).idsHash
}

function csvColumns(headers: string[]): string[] {
  if (new Set(headers).size !== headers.length || headers.filter(name => name === 'id').length !== 1)
    throw new Error('CSV requires unique headers and exactly one id column')
  return headers
}
function csvParser() {
  return parse({ columns: csvColumns })
}
function csvRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid CSV record')
  const record: Record<string, string> = {}
  for (const [key, cell] of Object.entries(value)) {
    if (typeof cell !== 'string') throw new Error('Invalid CSV cell')
    record[key] = cell
  }
  return record
}
async function csvHash(source: Readable): Promise<IdDigest> {
  const hash = idHasher()
  let headersSeen = false
  const parser = parse({
    columns: (headers: string[]) => {
      headersSeen = true
      return csvColumns(headers)
    },
  })
  await pipeline(source, parser, async records => {
    for await (const value of records) hash.add(csvRecord(value).id)
  })
  if (!headersSeen) throw new Error('CSV requires an id header')
  return hash.digest()
}
export function csvIdsHashStream(path: string): Promise<IdDigest> {
  return csvHash(createReadStream(path))
}
export function csvIdsHash(csv: string): Promise<IdDigest> {
  return csvHash(Readable.from([csv]))
}

/**
 * Atomically rewrite an export CSV, replacing its first-row receipt. All cells
 * are parsed and re-serialized as strings; this preserves the export serializer's
 * string-cell contract, not arbitrary foreign CSV type or byte formatting.
 */
export async function finalizeCsvWithToken(filePath: string, token: string): Promise<void> {
  const temporary = `${filePath}.${randomUUID()}.tmp`
  let count = 0
  try {
    await pipeline(
      createReadStream(filePath),
      csvParser(),
      async function* (records) {
        for await (const value of records) {
          const row = csvRecord(value)
          if (Object.keys(row).at(-1) !== ProvenanceColumn) throw new Error('Missing final provenance column')
          validateId(row.id)
          row[ProvenanceColumn] = count++ === 0 ? token : ''
          yield row
        }
      },
      stringify({ header: true, quoted: true }),
      createWriteStream(temporary, { flags: 'wx', mode: 0o600 })
    )
    if (count === 0) throw new Error('Cannot finalize an empty CSV')
    await rename(temporary, filePath)
  } catch (error) {
    await unlink(temporary).catch(() => {})
    throw error
  }
}

export async function checkExportReceipt(
  filePath: string,
  exportId: string,
  userRef: string,
  source: KeySource
): Promise<ReceiptClaims | undefined> {
  const digest = await csvIdsHashStream(filePath)
  if (digest.idsCount === 0) return undefined
  let token = ''
  const input = createReadStream(filePath)
  const parser = csvParser()
  input.on('error', error => parser.destroy(error))
  input.pipe(parser)
  try {
    for await (const value of parser) {
      token = csvRecord(value)[ProvenanceColumn]
      break // Stop at the first logical record, including quoted newlines.
    }
  } finally {
    input.destroy()
    parser.destroy()
  }
  const result = verifyReceipt(token, source)
  if (
    !result.valid ||
    result.claims.kind !== 'export' ||
    result.claims.exportId !== exportId ||
    result.claims.userRef !== userRef ||
    result.claims.idsHash !== digest.idsHash ||
    result.claims.idsCount !== digest.idsCount
  ) {
    throw new Error('Export provenance check failed')
  }
  return result.claims
}
