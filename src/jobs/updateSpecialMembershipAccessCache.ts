import { WellKnownKeys } from '@/cache.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import type { ImpressoApplication } from '@/types.js'

import { updateWellKnownEntry } from '@/internalServices/wellKnownCache.js'
import type { PreparedWellKnownEntry, UpdateWellKnownCacheOptions } from '@/internalServices/wellKnownCache.js'

/**
 * Prepare a bitmapPosition-indexed special-membership-access lookup and store it in cache.
 */
export const prepareSpecialMembershipAccessCache = async (
  app: ImpressoApplication
): Promise<PreparedWellKnownEntry> => {
  const sequelizeClient = app.get('sequelizeClient')
  if (sequelizeClient == null) throw new Error('Database is required to prepare the special membership access cache')
  const accessModel = SpecialMembershipAccess.initialize(sequelizeClient)
  const rows = await accessModel.findAll()

  const byBitmapPosition = Object.fromEntries(
    rows.map(row => {
      const item = row.toJSON()
      return [String(item.bitmapPosition), item]
    })
  )

  return { key: WellKnownKeys.SpecialMembershipAccessByBitmapPosition, data: JSON.stringify(byBitmapPosition) }
}

const run = async (app: ImpressoApplication, options?: UpdateWellKnownCacheOptions): Promise<void> => {
  await updateWellKnownEntry(
    app.get('cacheManager'),
    WellKnownKeys.SpecialMembershipAccessByBitmapPosition,
    () => prepareSpecialMembershipAccessCache(app),
    options
  )
}

export default run
