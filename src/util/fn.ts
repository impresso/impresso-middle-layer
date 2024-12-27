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
