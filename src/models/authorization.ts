/**
 * Contains models used to transport Authorization information.
 */

/**
 * A key used to attach authoriation context to any object.
 * The key is a symbol to avoid conflicts with other properties
 * and to satisfy objects interfaces without explicitly declaring
 * the property.
 *
 * Usage:
 * cosnt obj: MyInterface = {
 *   "fields": "value",
 *   [AuthorizationBitmapsKey]: { ... } satisfies AuthorizationBitmapsDTO
 * }
 */
export const AuthorizationBitmapsKey: symbol = Symbol('bitmapExplore')

/**
 * Represents authorization permissions using bitmaps.
 *
 * @property explore - Bitmap indicating permission to explore resources.
 * @property getTranscript - Bitmap indicating permission to retrieve transcripts.
 * @property getImages - Bitmap indicating permission to access images.
 */
export interface AuthorizationBitmapsDTO {
  explore?: bigint
  getTranscript?: bigint
  getImages?: bigint
  getAudio?: bigint
}

const isPossiblyBigInt = (value: any): value is bigint => {
  return typeof value === 'bigint' || (typeof value === 'number' && value <= Number.MAX_SAFE_INTEGER)
}

/**
 * Type guard.
 */
export const isAuthorizationBitmapsDTO = (obj: any): obj is AuthorizationBitmapsDTO => {
  return (
    obj != null &&
    (obj.explore == null || isPossiblyBigInt(obj.explore)) &&
    (obj.getTranscript == null || isPossiblyBigInt(obj.getTranscript)) &&
    (obj.getImages == null || isPossiblyBigInt(obj.getImages))
  )
}
