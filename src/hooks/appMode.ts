import { HookContext, HookFunction, Service } from '@feathersjs/feathers'
import { ImpressoApplication } from '@/types.js'

export type ImpressoAppHookContext<S = Service> = HookContext<ImpressoApplication, S>
type ImpressoAppHookFunction<S = Service> = HookFunction<ImpressoApplication, S>

type ApplicationCondition = (app: ImpressoApplication) => boolean
export type ContextCondtition<S = Service> = (context: ImpressoAppHookContext<S>) => boolean

const asContextCondition = <S = Service>(appCondition: ApplicationCondition): ContextCondtition<S> => {
  return (context: ImpressoAppHookContext<S>) => {
    return appCondition(context.app)
  }
}

const hookApplicator = <S = Service>(
  condition: ContextCondtition<S>,
  fn: ImpressoAppHookFunction<S>
): ImpressoAppHookFunction<S> => {
  return function (this: S, context: ImpressoAppHookContext<S>) {
    if (condition(context)) {
      return fn.call(this, context)
    }
    return context
  }
}

const hooksApplicator = <S = Service>(condition: ContextCondtition<S>) => {
  return (functions: ImpressoAppHookFunction<S>[]): ImpressoAppHookFunction<S>[] => {
    return functions.map(fn => hookApplicator(condition, fn))
  }
}

/**
 * Hooks to apply only in the public API.
 * @param functions Array of hook functions to apply only in the public API.
 */
export const inPublicApi = <S = Service>(functions: ImpressoAppHookFunction<S>[]) => {
  return hooksApplicator<S>(asContextCondition(app => app.get('isPublicApi') == true))(functions)
}

/**
 * Hooks to apply only in the public API or when the alternative condition is met.
 * @param functions Array of hook functions to apply only in the public API or when the alternative condition is met.
 */
export const inPublicApiOrWhen = <S = Service>(
  functions: ImpressoAppHookFunction<S>[],
  alternativeCondition: ContextCondtition<S>
) => {
  return hooksApplicator<S>(context => context.app.get('isPublicApi') == true || alternativeCondition(context))(
    functions
  )
}

/**
 * Hooks to apply only in the webapp API.
 * @param functions Array of hook functions to apply only in the webapp API.
 */
export const inWebAppApi = <S = Service>(functions: ImpressoAppHookFunction<S>[]) => {
  return hooksApplicator<S>(asContextCondition(app => app.get('isPublicApi') != true))(functions)
}
