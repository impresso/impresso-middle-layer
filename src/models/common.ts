import { BaseFind } from './generated/schemas'
export interface FindResponse<T> extends Omit<BaseFind, 'data'> {
  data: T[]
}
