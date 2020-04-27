// @ts-check

export interface TimeRangeContextParameters {
  startYear?: string
  endYear?: string
}

export interface ItemContextEntity {
  id: string
  weight: number
}

export interface ItemContextParameters {
  entities: ItemContextEntity[]
}

export type RelevanceContextItemType = 'timeRange' | 'locations' | 'persons' | 'topics'

export interface RelevanceContextItem {
  type: RelevanceContextItemType
  parameters: TimeRangeContextParameters | ItemContextParameters
  weight?: number
}

export interface Pagination {
  skip?: number
  limit?: number
}
