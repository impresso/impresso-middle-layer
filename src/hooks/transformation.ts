import { HookContext, HookFunction } from '@feathersjs/feathers'
import { ImpressoApplication } from '../types'

export const transformResponse = <S, I, O>(
  transformer: (item: I) => O,
  condition?: (context: HookContext<ImpressoApplication>) => boolean
): HookFunction<ImpressoApplication, S> => {
  return context => {
    if (context.type != 'after') throw new Error('The redactResponseDataItem hook should be used as an after hook only')
    if (condition != null && !condition(context)) return context

    if (context.result != null) {
      const ctx = context as any
      ctx.result = transformer(context.result as I)
    }
    return context
  }
}

export const transformResponseDataItem = <S, I, O>(
  transformer: (item: I) => O,
  condition?: (context: HookContext<ImpressoApplication>) => boolean,
  dataItemsField?: string
): HookFunction<ImpressoApplication, S> => {
  return context => {
    if (context.type != 'after') throw new Error('The redactResponseDataItem hook should be used as an after hook only')
    if (condition != null && !condition(context)) return context

    if (context.result != null) {
      const result = context.result as Record<string, any>
      const field = dataItemsField ?? 'data'
      result[field] = result[field].map(transformer)
    }
    return context
  }
}
