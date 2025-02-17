const stringifyReplacer = (key: any, value: any) => {
  if (typeof value === 'bigint') {
    return value.toString(10)
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.getOwnPropertyNames(value)
    const symbols = Object.getOwnPropertySymbols(value)

    const allKeys: Array<string | symbol> = keys.concat(symbols as any)

    return allKeys.reduce((acc: Record<string, any>, k) => {
      const kString = typeof k === 'symbol' ? k.toString() : new String(k).toString()
      acc[kString] = value[k]
      return acc
    }, {})
  }
  return value
}

/**
 * Convert record to a hash key, respecting symbols as keys.
 * Symbols are used as keys in sequelize statements.
 */
export const getCacheKey = (input: Record<any, any>): string => {
  return Buffer.from(JSON.stringify(input, stringifyReplacer)).toString('base64')
}

export const serialize = (input: Record<any, any>): string => {
  return JSON.stringify(input, stringifyReplacer)
}
