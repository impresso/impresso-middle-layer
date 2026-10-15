import { createReceipt, deriveProvenanceKey, hashIds, type ProvenanceSigningConfig } from '@/util/provenance.js'
import type { ProvenanceConfig } from '@/models/generated/app/configuration.js'

export const authSecret = 'stable-authentication-secret-for-provenance-tests'
export const keys = deriveProvenanceKey(authSecret)
export const config: ProvenanceConfig = {
  enabled: true,
  issuer: 'impresso-middle-layer',
  audience: 'provenance',
}
export const signingConfig: ProvenanceSigningConfig = { provenance: config, authSecret }
export const receipt = () =>
  createReceipt({ kind: 'export', exportId: 'export', userRef: 'user', ...hashIds(['a', 'b']) }, signingConfig)
