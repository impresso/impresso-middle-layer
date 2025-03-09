import { ClientService, Params } from '@feathersjs/feathers'
import { buildPythonFunctionCall, isFunctionName, isResource } from '../../logic/filters/impressoPy'
import { NotFound } from '@feathersjs/errors'
import { parseFilters } from '../../util/queryParameters'
import { Filter } from 'impresso-jscommons'

type SupportAspect = 'impresso-py-function'

interface ImpressoPyFunction {
  code: string
}

interface GetQuery {
  filters?: string
  resource?: string
  functionName?: string
}

type Result = ImpressoPyFunction

export class DatalabSupportService implements Pick<ClientService<Result, unknown, unknown, unknown>, 'get'> {
  async get(id: SupportAspect, params?: Params<GetQuery>): Promise<Result> {
    if (id === 'impresso-py-function') {
      const { filters, resource, functionName } = params?.query ?? {}
      if (filters == null || !isResource(resource) || !isFunctionName(functionName)) {
        throw new Error('Missing required parameters')
      }
      const deserialisedFilters = parseFilters(filters) as Filter[]
      return { code: buildPythonFunctionCall(resource, functionName, deserialisedFilters) }
    }
    throw new NotFound(`Aspect ${id} not found`)
  }
}
