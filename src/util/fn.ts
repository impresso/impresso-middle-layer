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
