import { createHash } from 'crypto'

/**
 * Creates a SHA-256 hash of the input string
 * @param input - The string to be hashed
 * @returns The SHA-256 hash as a base64 string
 */
export function createSha256Hash(input: string): string {
  return createHash('sha256').update(input).digest('base64')
}
