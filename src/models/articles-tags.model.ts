export interface IArticleTag {
  articleId: string
  tagId: string
  creationDate: Date
  lastModifiedDate: Date
}

export class ArticleTag implements IArticleTag {
  public articleId: string
  public tagId: string
  public creationDate: Date
  public lastModifiedDate: Date

  constructor({
    articleId = '',
    tagId = '',
    creationDate = new Date(),
    lastModifiedDate = new Date(),
  }: Partial<IArticleTag> = {}) {
    this.articleId = String(articleId)
    this.tagId = String(tagId)

    if (creationDate instanceof Date) {
      this.creationDate = creationDate
    } else {
      this.creationDate = new Date(creationDate)
    }

    if (lastModifiedDate instanceof Date) {
      this.lastModifiedDate = lastModifiedDate
    } else {
      this.lastModifiedDate = new Date(lastModifiedDate)
    }
  }
}

export default function (params: Partial<IArticleTag>) {
  return new ArticleTag(params)
}
