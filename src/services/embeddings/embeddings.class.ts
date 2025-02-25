import type { ClientService, Params } from '@feathersjs/feathers'
import { SimpleSolrClient } from '../../internalServices/simpleSolr'
import { PublicFindResponse as FindResponse } from '../../models/common'
import { ImpressoApplication } from '../../types'
import { escapeValue } from '../../util/solr/filterReducers'

type FindQuery = Pick<FindResponse<unknown>['pagination'], 'limit' | 'offset'> & {
  term: string
  language?: 'de' | 'fr' | 'lb'
  top_k?: number
}

const EmbeddingProperty = 'fastText_emb_v100'

interface SolrEmbeddingsDoc {
  word_s: string
  [EmbeddingProperty]: number[]
  lg_s: string
  id: string
}

export const buildGetTermEmbeddingVectorSolrQuery = (term: string, language?: string): string => {
  const parts = [`word_s:(${escapeValue(term)})`, language ? `lg_s:${language}` : undefined]
  return parts.filter(p => p != null).join(' AND ')
}

export const buildFindBySimilarEmbeddingsSolrQuery = (vectors: number[][], topK: number, language?: string): string => {
  const vectorsCondition = vectors
    .map(vector => `({!knn f=${EmbeddingProperty} topK=${topK}}${JSON.stringify(vector)})`)
    .join(' OR ')
  const languageCondition = language ? `lg_s:${language}` : undefined
  const parts = [vectorsCondition, languageCondition].filter(p => p != null)
  return parts.length > 1 ? parts.map(p => `(${p})`).join(' AND ') : parts[0]
}

export const DefaultPageSize = 20
export const DefaultTopK = 20

export class EmbeddingsService implements Pick<ClientService<string, unknown, unknown, FindResponse<string>>, 'find'> {
  private readonly app: ImpressoApplication

  constructor({ app }: { app: ImpressoApplication }) {
    this.app = app
  }

  private get solr(): SimpleSolrClient {
    return this.app.service('simpleSolrClient')
  }

  private async getTermEmbeddingVectors(term: string, language?: string): Promise<number[][]> {
    const result = await this.solr.select<Pick<SolrEmbeddingsDoc, typeof EmbeddingProperty>>(
      this.solr.namespaces.WordEmbeddings,
      {
        body: {
          query: buildGetTermEmbeddingVectorSolrQuery(term, language),
          fields: EmbeddingProperty,
          limit: 1,
          offset: 0,
        },
      }
    )
    return result?.response?.docs?.map(item => item[EmbeddingProperty]) ?? []
  }

  private async getWordsMatchingVectors(
    vectors: number[][],
    topK: number,
    offset: number,
    limit: number,
    language?: string
  ): Promise<Omit<SolrEmbeddingsDoc, typeof EmbeddingProperty>[]> {
    const result = await this.solr.select<Omit<SolrEmbeddingsDoc, typeof EmbeddingProperty>>(
      this.solr.namespaces.WordEmbeddings,
      {
        body: {
          query: buildFindBySimilarEmbeddingsSolrQuery(vectors, topK, language),
          fields: ['word_s', 'lg_s', 'id'].join(','),
          limit,
          offset,
        },
      }
    )
    return result?.response?.docs ?? []
  }

  async find(params?: Params<FindQuery>): Promise<FindResponse<string>> {
    if (!params?.query) {
      throw new Error('Query parameters are required')
    }

    const { term, language, top_k: topK = DefaultTopK, limit = DefaultPageSize, offset = 0 } = params.query

    const vectors = await this.getTermEmbeddingVectors(term, language)
    const matches = await this.getWordsMatchingVectors(vectors, topK, offset, limit, language)

    return {
      pagination: {
        limit,
        offset,
        total: matches.length,
      },
      data: matches.map(d => d.word_s),
    }
  }
}
