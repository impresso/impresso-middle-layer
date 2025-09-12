import { HookContext, HookFunction, Service } from '@feathersjs/feathers'
import { ImpressoApplication } from '../types'

type ImpressoAppHookContext<S = Service> = HookContext<ImpressoApplication, S>
type ImpressoAppHookFunction<S = Service> = HookFunction<ImpressoApplication, S>

type ApplicationCondition = (app: ImpressoApplication) => boolean

const hookApplicator = <S = Service>(
  condition: ApplicationCondition,
  fn: ImpressoAppHookFunction<S>
): ImpressoAppHookFunction<S> => {
  return function (this: S, context: ImpressoAppHookContext<S>) {
    if (condition(context.app)) {
      return fn.call(this, context)
    }
    return context
  }
}

const hooksApplicator = <S = Service>(applicationCondition: (app: ImpressoApplication) => boolean) => {
  return (functions: ImpressoAppHookFunction<S>[]): ImpressoAppHookFunction<S>[] => {
    return functions.map(fn => hookApplicator(applicationCondition, fn))
  }
}

/**
 * Hooks to apply only in the public API.
 * @param functions Array of hook functions to apply only in the public API.
 */
export const inPublicApi = <S = Service>(functions: ImpressoAppHookFunction<S>[]) => {
  return hooksApplicator<S>(app => app.get('isPublicApi') == true)(functions)
}

/**
 * Hooks to apply only in the webapp API.
 * @param functions Array of hook functions to apply only in the webapp API.
 */
export const inWebAppApi = <S = Service>(functions: ImpressoAppHookFunction<S>[]) => {
  return hooksApplicator<S>(app => app.get('isPublicApi') != true)(functions)
}
