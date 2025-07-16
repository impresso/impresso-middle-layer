type KeyFunc<T> = (item: T) => string

export function groupBy<T>(array: T[], keyFunc: KeyFunc<T>): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const key = keyFunc(item)
      if (!result[key]) {
        result[key] = []
      }
      result[key].push(item)
      return result
    },
    {} as Record<string, T[]>
  )
}

export function removeNullAndUndefined<T>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeNullAndUndefined(item)) as any
  }

  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value === null || value === undefined) {
      return acc
    }

    const updatedValue = typeof value === 'object' ? removeNullAndUndefined(value) : value
    acc[key as keyof T] = updatedValue
    return acc
  }, {} as Partial<T>)
}

export function setDifference<T, K>(setA: Set<T> | T[], setB: Set<K> | K[]): Set<Exclude<T, K>> {
  const difference = new Set<Exclude<T, K>>()

  const setASet = setA instanceof Set ? setA : new Set(setA)
  const setBSet = setB instanceof Set ? setB : new Set(setB)

  for (const item of setASet) {
    if (!setBSet.has(item as any)) {
      difference.add(item as Exclude<T, K>)
    }
  }
  return difference
}

/**
 * Maps values in a Record while preserving keys
 * @param record The original record
 * @param mapFn The function to transform each value
 * @returns A new record with transformed values
 */
export const mapRecordValues = <K extends string | number | symbol, V, R>(
  record: Record<K, V>,
  mapFn: (value: V, key: K) => R
): Record<K, R> => {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, mapFn(value as V, key as K)])) as Record<
    K,
    R
  >
}
