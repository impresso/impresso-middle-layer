import type { Id, Params, ServiceMethods } from '@feathersjs/feathers'
import { BadRequest } from '@feathersjs/errors'
import { experiments } from './experiments/index.js'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import { ExperimentBase } from './experiments/base.js'
import { ImpressoApplication } from '@/types.js'

export const ValidExperimentIds: readonly string[] = Object.freeze(experiments.map(e => e.id))

export interface ExperimentData {
  [key: string]: any
}

export type ExperimentInfo = Pick<ExperimentBase<any, any>, 'id' | 'name' | 'description'>

export interface ExperimentUpdateParams extends Params {
  route?: {
    id?: string
  }
}

export class Experiments implements Pick<ServiceMethods<ExperimentData>, 'find' | 'update'> {
  constructor(private readonly app: ImpressoApplication) {}

  async find(params?: Params): Promise<FindResponse<ExperimentInfo>> {
    const experimentList: ExperimentInfo[] = experiments.map(exp => ({
      id: exp.id,
      name: exp.name,
      description: exp.description,
    }))

    return {
      pagination: {
        limit: experimentList.length,
        offset: 0,
        total: experimentList.length,
      },
      data: experimentList,
    }
  }

  async update(id: Id, data: ExperimentData, params?: ExperimentUpdateParams): Promise<ExperimentData> {
    // Validate experiment ID
    if (!ValidExperimentIds.includes(id as string)) {
      throw new BadRequest(`Invalid experiment ID. Must be one of: ${ValidExperimentIds.join(', ')}`)
    }

    const response = await experiments.find(exp => exp.id === id)!.execute(data as any, this.app)

    return response
  }
}
