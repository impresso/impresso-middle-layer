import { ImpressoApplication } from '@/types.js'

/**
 * Base interface for an experiment container.
 */
export interface ExperimentBase<B extends Record<string, any>, R extends Record<string, any>> {
  id: string
  name: string
  description?: string
  execute: (body: B, app: ImpressoApplication) => Promise<R>
}
