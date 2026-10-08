import { generateKeyPairSync } from 'node:crypto'
import { createReceipt, hashIds } from '@/util/provenance.js'
import type { ProvenanceConfig } from '@/models/generated/app/configuration.js'

export const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
export const config: ProvenanceConfig = {
  enabled: true,
  issuer: 'impresso-middle-layer',
  audience: 'provenance',
  activeKid: 'one',
  privateKey: keys.privateKey,
  publicKeys: { one: keys.publicKey },
}
export const receipt = () =>
  createReceipt({ kind: 'export', exportId: 'export', userRef: 'user', ...hashIds(['a', 'b']) }, config)
