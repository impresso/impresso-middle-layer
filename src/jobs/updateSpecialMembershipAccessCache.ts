import type { Sequelize } from 'sequelize'
import { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import type { ISpecialMembershipAccessAttributes } from '@/models/special-membership-access.model.js'
import type { ImpressoApplication } from '@/types.js'

/** 100 days */
const DefaultTtl = 60 * 60 * 24 * 100 * 1000

/**
 * Prepare a bitmapPosition-indexed special-membership-access lookup and store it in cache.
 */
const run = async (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  const cached = await cache.get(WellKnownKeys.SpecialMembershipAccessByBitmapPosition)
  if (cached != null) return

  const sequelizeClient = app.get('sequelizeClient') as Sequelize
  const accessModel = SpecialMembershipAccess.initialize(sequelizeClient)
  const rows = await accessModel.findAll()

  const byBitmapPosition = rows.reduce(
    (acc, row) => {
      const item = row.toJSON() as ISpecialMembershipAccessAttributes
      acc[String(item.bitmapPosition)] = item
      return acc
    },
    {} as Record<string, ISpecialMembershipAccessAttributes>
  )

  await cache.set(WellKnownKeys.SpecialMembershipAccessByBitmapPosition, JSON.stringify(byBitmapPosition), DefaultTtl)
  await cache.set(WellKnownMetadataKeys.SpecialMembershipAccessComputedAt, new Date().toISOString(), DefaultTtl)
}

export default run
