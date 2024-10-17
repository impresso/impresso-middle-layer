export interface FindQueryParams {
  offset: number
  limit: number
  order_by?: string
  user: {
    id: string
  }
}
