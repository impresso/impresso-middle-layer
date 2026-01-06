import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { ImpressoApplication } from '@/types.js'
import { disallow } from 'feathers-hooks-common'

export const disableInPublicApi = async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
  const isPublicApi = context.app.get('isPublicApi')

  if (isPublicApi) return disallow('external')(context)
  return next()
}

interface OptionsMethodsPart {
  methods?: string[]
  events?: string[]
}

export const optionsDisabledInPublicApi = (app: ImpressoApplication): OptionsMethodsPart | undefined => {
  const isPublicApi = app.get('isPublicApi')

  if (isPublicApi) return { methods: [] }
  return { events: [] }
}
