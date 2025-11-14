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

/**
 * Inverts the keys and values of a record.
 * @param original The original record
 * @returns A new record with inverted keys and values
 */
export const invertRecord = <T extends string>(original: Record<string, T>): Record<T, string> => {
  return Object.fromEntries(Object.entries(original).map(([key, value]) => [value, key])) as Record<T, string>
}

/**
 * Executes async functions in parallel with a concurrency limit.
 * @param inputs Array of inputs to process
 * @param asyncFn Async function that processes each input
 * @param concurrencyLimit Maximum number of parallel executions (default: 1)
 * @returns Promise resolving to array of results in original order
 */
export async function parallelLimit<T, R>(
  inputs: T[],
  asyncFn: (input: T) => Promise<R>,
  concurrencyLimit: number = 1
): Promise<R[]> {
  if (concurrencyLimit < 1) {
    throw new Error('concurrencyLimit must be at least 1')
  }

  const results: R[] = new Array(inputs.length)
  const executing: Array<{ promise: Promise<void>; index: number }> = []

  for (let index = 0; index < inputs.length; index++) {
    const promise = Promise.resolve().then(async () => {
      results[index] = await asyncFn(inputs[index])
    })

    executing.push({ promise, index })

    if (executing.length >= concurrencyLimit) {
      // Wait for the first promise to complete by racing wrapped promises that return their index
      const completedIndex = await Promise.race(
        executing.map((item, idx) => item.promise.then(() => idx))
      )
      // Remove the completed promise from the executing array
      executing.splice(completedIndex, 1)
    }
  }

  // Wait for all remaining promises to complete
  await Promise.all(executing.map((p) => p.promise))
  return results
}
