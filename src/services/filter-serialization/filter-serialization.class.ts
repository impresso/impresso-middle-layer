import { protobuf, type Filter } from 'impresso-jscommons'

export interface FilterSerializationRequest {
  filters: Filter[]
}

export interface FilterSerializationResponse {
  filters: string
}

export class FilterSerializationService {
  async create(data: FilterSerializationRequest): Promise<FilterSerializationResponse> {
    return {
      filters: protobuf.searchQuery.serialize({ filters: data.filters }),
    }
  }
}
