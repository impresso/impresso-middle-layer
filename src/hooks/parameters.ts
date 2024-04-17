import type { Application, HookContext } from '@feathersjs/feathers'

export const decodeJsonQueryParameters = (parametersNames: string[]) => async (context: HookContext<Application>) => {
  const { query } = context.params

  for (const parameterName of parametersNames) {
    if (query[parameterName] != null) {
      if (typeof query[parameterName] === 'string') {
        query[parameterName] = JSON.parse(query[parameterName] as string)
      } else if (Array.isArray(query[parameterName])) {
        const items = (query[parameterName] as string[]).map(item =>
          typeof item === 'string' ? JSON.parse(item) : item
        )
        query[parameterName] = items
      }
    }
  }

  context.params.query = query
}

export const decodePathParameters = (parametersNames: string[]) => async (context: HookContext<Application>) => {
  for (const parameterName of parametersNames) {
    if (context[parameterName] != null) {
      context[parameterName] = decodeURIComponent(context[parameterName])
    }
  }
}
