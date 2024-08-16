import { Filter } from 'impresso-jscommons'
import { Op } from 'sequelize'

interface FilterTuple {
  solrFilters: Filter[]
  sequelizeFilters: Filter[]
}

export const sortFindEntitiesFilters = (filters: Filter[]): FilterTuple => {
  const solrFilters = filters.filter(f => f.type !== 'wikidataId')
  const sequelizeFilters = filters.filter(f => f.type === 'wikidataId')
  return { solrFilters, sequelizeFilters }
}

export const buildSequelizeWikidataIdFindEntitiesCondition = (filters: Filter[]): Record<string, any> | undefined => {
  const supportedFilters = filters.filter(f => f.type === 'wikidataId' && f.q != null)

  const items = supportedFilters.map(f => {
    const operator = f.context === 'exclude' ? Op.notIn : Op.in
    return {
      [operator]: typeof f.q === 'string' ? [f.q] : f.q,
    }
  })

  if (items.length === 0) {
    return undefined
  }

  return { wikidataId: { [Op.and]: items } }
}
