import JSONBigInt from 'json-bigint'
import { Encoder, Decoder } from 'socket.io-parser'

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

export class CustomDecoder extends Decoder {
  constructor() {
    super()
  }
}

const parser = JSONBigInt({ useNativeBigInt: true })

export const safeParseJson = (json: string) => {
  return parser.parse(json)
}

export const safeStringifyJson = (o: any, space?: number) => {
  return parser.stringify(o, undefined, space)
}
