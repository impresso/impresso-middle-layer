export interface IArticleEntity {
  articleUid: string
  entityUid: string
  frequence: number
}

export class ArticleEntity implements IArticleEntity {
  articleUid: string
  entityUid: string
  frequence: number

  constructor({ articleUid = '', entityUid = '', frequence = 0 } = {}) {
    this.articleUid = String(articleUid)
    this.entityUid = String(entityUid)
    this.frequence = typeof frequence == 'string' ? parseInt(frequence, 10) : frequence
  }
}

export default function (params: any) {
  return new ArticleEntity(params)
}

export const Model = ArticleEntity
