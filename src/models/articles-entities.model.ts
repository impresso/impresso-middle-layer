export interface IArticleEntity {
  articleId: string
  entityId: string
  frequence: number
}

export class ArticleEntity implements IArticleEntity {
  articleId: string
  entityId: string
  frequence: number

  constructor({ articleId = '', entityId = '', frequence = 0 } = {}) {
    this.articleId = String(articleId)
    this.entityId = String(entityId)
    this.frequence = typeof frequence == 'string' ? parseInt(frequence, 10) : frequence
  }
}

export default function (params: any) {
  return new ArticleEntity(params)
}
