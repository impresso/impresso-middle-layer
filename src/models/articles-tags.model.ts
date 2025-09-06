export interface IArticleTag {
  articleUid: string
  tagUid: string
  creationDate: Date
  lastModifiedDate: Date
}

export class ArticleTag implements IArticleTag {
  public articleUid: string
  public tagUid: string
  public creationDate: Date
  public lastModifiedDate: Date

  constructor({
    articleUid = '',
    tagUid = '',
    creationDate = new Date(),
    lastModifiedDate = new Date(),
  }: Partial<IArticleTag> = {}) {
    this.articleUid = String(articleUid)
    this.tagUid = String(tagUid)

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
