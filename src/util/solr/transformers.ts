export const parseDPFS = <T>(builder: (pair: [string, string]) => T, dpfs?: string[]): T[] => {
  if (!dpfs || !dpfs.length) {
    return []
  }
  const trimmed = dpfs.filter(d => d.trim().length > 0)
  if (trimmed.length === 0) {
    return []
  }

  return trimmed[0].split(/(?<=\|\d+)\s|(?<=\|\d+\.)\s|(?<=\|\d+\.\d+)\s/).map(d => {
    const [id, count] = d.split('|') as [string, string]
    return builder([id, count])
  })
}

export const asList = <T>(value?: string | T[]): T[] => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T[]
  }
  return value as T[]
}

export const asNumberArray = (value?: string | number[]): number[] | undefined => {
  if (typeof value === 'string') {
    return JSON.parse(value) as number[]
  }
  return value as number[]
}

/**
 * Convert an array of items to pairs starting with the initial item.
 * E.g.: [2,5,9], 0 => [[0,2],[2,5],[5,9]]
 */
export const toPairs = <T>(value: T[], initialItem: T): [T, T][] => {
  return value.reduce(
    (pairs, item, index) => {
      const prevItem = index === 0 ? initialItem : value[index - 1]
      pairs.push([prevItem, item])
      return pairs
    },
    [] as [T, T][]
  )
}
