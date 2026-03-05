import { BaseFind } from './generated/deprecated/internalApi.js'
import { BaseFindResponse } from './generated/app/responses.js'

export interface FindResponse<T> extends Omit<BaseFind, 'data'> {
  data: T[]
}

/**
 * Use this for all new services.
 */
export interface PublicFindResponse<T> extends Omit<BaseFindResponse, 'data'> {
  data: T[]
}
