import { Encoder } from 'socket.io-parser'

/**
 * A replacer that encodes bigint as strings.
 */
export const customJSONReplacer = (key: string, value: any) => {
  if (typeof value === 'bigint') {
    return value.toString(10)
  }
  return value
}

export class CustomEncoder extends Encoder {
  constructor() {
    super(customJSONReplacer)
  }
}
