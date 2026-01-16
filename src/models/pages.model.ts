import {
  getJSONUrl,
  getManifestJSONUrl,
  getThumbnailUrl,
  getExternalThumbnailUrl,
  sanitizeIiifImageUrl,
} from '@/util/iiif.js'
import { Config, ImageUrlRewriteRule } from '@/models/generated/common.js'
import { IArticleEntity, ArticleEntity } from '@/models/articles-entities.model.js'
import { IArticleTag, ArticleTag } from '@/models/articles-tags.model.js'
import { Sequelize } from 'sequelize'

import { DataTypes } from 'sequelize'
import Issue from '@/models/issues.model.js'
import initConfig from '@feathersjs/configuration'

const config = initConfig()() as any as Config

interface IPage {
  uid: string
  num: number
  issueUid: string
  newspaperUid: string
  iiif: string
  iiifThumbnail: string
  accessRights: string
  labels: string[]
  countArticles: number
  hasCoords: boolean
  hasErrors: boolean
  regions: any[]
  articlesEntities: IArticleEntity[]
  articlesTags: IArticleTag[]
}

export default class Page implements IPage {
  public uid: string
  public num: number
  public issueUid: string
  public newspaperUid: string
  public iiif: string
  public iiifThumbnail: string
  public accessRights: string
  public labels: string[]
  public countArticles: number = 0
  public hasCoords: boolean
  public hasErrors: boolean
  public regions: any[] = []
  public articlesEntities: IArticleEntity[] = []
  public articlesTags: IArticleTag[] = []
  public collections: any[] = []

  constructor(
    {
      uid = '',
      iiif = '',
      labels = ['page'],
      // num = 0,
      // converted coordinates
      hasCoords = false,
      // has json errors
      hasErrors = false,
      // number of articles
      countArticles = -1,

      // All user ArticleTag instances on this pages
      articlesTags = [],

      // top 20 ArticleEntity intances
      articlesEntities = [],

      // All collections for this page
      collections = [],
      regions = [],
      accessRights = 'nd',
    } = {},
    complete = false
  ) {
    this.uid = String(uid)

    // "LCE-1864-07-17-a-p0004".match(/(([^-]*)-\d{4}-\d{2}-\d{2}-[a-z])*-p0*([0-9]+)/)
    const match = this.uid.match(/(([^-]*)-\d{4}-\d{2}-\d{2}-[a-z])*-p0*([0-9]+)/)
    if (!match) {
      throw new Error(`Invalid page UID: ${this.uid}`)
    }
    const [, issueUid, newspaperUid, num] = match

    this.num = parseInt(num, 10)
    this.issueUid = issueUid
    this.newspaperUid = newspaperUid

    // if any iiif is provided
    const rules = config.images.rewriteRules
    if (!iiif.length) {
      this.iiif = sanitizeIiifImageUrl(getJSONUrl(this.uid, config.images.baseUrl), rules ?? [])
      this.iiifThumbnail = sanitizeIiifImageUrl(getThumbnailUrl(this.uid, config.images.baseUrl), rules ?? [])
    } else {
      this.iiif = sanitizeIiifImageUrl(getManifestJSONUrl(iiif), rules ?? [])
      this.iiifThumbnail = sanitizeIiifImageUrl(getExternalThumbnailUrl(this.iiif), rules ?? [])
    }

    this.accessRights = accessRights

    this.labels = labels

    if (countArticles > -1) {
      this.countArticles = typeof countArticles == 'string' ? parseInt(countArticles, 10) : countArticles
    }

    this.hasCoords = Boolean(hasCoords)
    this.hasErrors = Boolean(hasErrors)

    // if (issue_uid) {
    //   this.issueUid = issue_uid;
    // }
    //
    if (regions) {
      this.regions = regions
    }

    if (complete) {
      this.articlesEntities = articlesEntities.map((d: any) => {
        if (d instanceof ArticleEntity) {
          return d
        }
        return new ArticleEntity(d)
      })

      this.articlesTags = articlesTags.map((d: any) => {
        if (d instanceof ArticleTag) {
          return d
        }
        return new ArticleTag(d)
      })

      this.collections = collections
    }
  }

  static sequelize(client: Sequelize) {
    const issue = Issue.sequelize(client)

    const page = client.define(
      'page',
      {
        uid: {
          type: DataTypes.STRING,
          primaryKey: true,
          field: 'id',
          unique: true,
        },
        issue_uid: {
          type: DataTypes.STRING,
          field: 'issue_id',
        },
        num: {
          type: DataTypes.SMALLINT,
          field: 'page_number',
        },
        hasCoords: {
          type: DataTypes.SMALLINT,
          field: 'has_converted_coordinates',
        },
        hasErrors: {
          type: DataTypes.SMALLINT,
          field: 'has_corrupted_json',
        },
        iiif: {
          type: DataTypes.STRING(200),
          field: 'iiif_manifest',
        },
      },
      {
        scopes: {
          withAccessRights: {
            include: [
              {
                model: issue,
                attributes: ['accessRights'],
              },
            ],
          },
          findAll: {
            include: [
              {
                model: issue,
                as: 'issue',
              },
            ],
          },
        },
      }
    )

    page.belongsTo(issue, {
      foreignKey: 'issue_id',
    })

    page.prototype.toJSON = function () {
      if ((this as any).issue) {
        return new Page({
          ...this.get(),
          accessRights: (this as any).issue.accessRights,
        })
      }
      return new Page(this.get())
    }

    return page
  }
}

export const withRewrittenIIIF = (page: IPage, rewriteRules: ImageUrlRewriteRule[] = []): IPage => {
  return {
    ...page,
    iiif: sanitizeIiifImageUrl(page.iiif, rewriteRules),
    iiifThumbnail: sanitizeIiifImageUrl(page.iiifThumbnail, rewriteRules),
  }
}
