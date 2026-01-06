import { HookContext, HookFunction } from '@feathersjs/feathers'
import { ImpressoApplication } from '@/types.js'

export const transformResponse = <S, I, O>(
  transformer: ((item: I) => O) | ((item: I, context: HookContext<ImpressoApplication>) => O),
  condition?: (context: HookContext<ImpressoApplication>) => boolean
): HookFunction<ImpressoApplication, S> => {
  return context => {
    if (context.type != 'after') throw new Error('The transformResponse hook should be used as an after hook only')
    if (condition != null && !condition(context)) return context

    if (context.result != null) {
      const ctx = context as any
      ctx.result = transformer(context.result as I, context)
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

export const renameTopLevelField = <S>(
  policy: [string, string],
  condition?: (context: HookContext<ImpressoApplication>) => boolean
): HookFunction<ImpressoApplication, S> => {
  return context => {
    if (context.type != 'after') throw new Error('The renameTopLevelField hook should be used as an after hook only')
    if (condition != null && !condition(context)) return context

    const [from, to] = policy
    const ctx = context as any

    if (ctx != null && ctx.result[from] != null) {
      ctx.result[to] = ctx.result[from]
      delete ctx.result[from]
    }
    return context
  }
}

export const renameQueryParameters = <S>(
  policy: Record<string, string>,
  condition?: (context: HookContext<ImpressoApplication>) => boolean
): HookFunction<ImpressoApplication, S> => {
  return context => {
    if (context.type != 'before') throw new Error('The renameQueryParameters hook should be used as an after hook only')
    if (condition != null && !condition(context)) return context

    const params = context.params as any

    const query: Record<string, any> = params?.query ?? {}

    for (const [from, to] of Object.entries(policy)) {
      if (query[from] != null) {
        query[to] = query[from]
        delete query[from]
      }
    }
    params.query = query

    return context
  }
}
