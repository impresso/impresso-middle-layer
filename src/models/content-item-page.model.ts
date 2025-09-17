import { DataTypes, ModelDefined, Sequelize } from 'sequelize'
import { ImpressoApplication } from '../types'
import {
  getExternalThumbnailUrl,
  getJSONUrl,
  getManifestJSONUrl,
  getThumbnailUrl,
  sanitizeIiifImageUrl,
} from '../util/iiif'

interface ContentItemPageAttributes {
  uid: string
  hasCoords: boolean
  hasErrors: boolean
  iiifManifest: string
}

export type ContentItemPageDbModel = ModelDefined<ContentItemPageAttributes, Omit<ContentItemPageAttributes, 'id'>>

export default class ContentItemPage implements ContentItemPageAttributes {
  uid: string
  hasCoords: boolean
  hasErrors: boolean
  iiifManifest: string

  constructor({ uid, hasCoords, hasErrors, iiifManifest }: ContentItemPageAttributes) {
    this.uid = uid
    this.hasCoords = hasCoords
    this.hasErrors = hasErrors
    this.iiifManifest = iiifManifest
  }

  static sequelize(client: Sequelize): ContentItemPageDbModel {
    const page = client.define(
      'page',
      {
        uid: {
          type: DataTypes.STRING,
          primaryKey: true,
          field: 'id',
          unique: true,
        },
        hasCoords: {
          type: DataTypes.SMALLINT,
          field: 'has_converted_coordinates',
        },
        hasErrors: {
          type: DataTypes.SMALLINT,
          field: 'has_corrupted_json',
        },
        iiifManifest: {
          type: DataTypes.STRING(200),
          field: 'iiif_manifest',
        },
      },
      {
        tableName: 'pages',
      }
    )

    page.prototype.toJSON = function () {
      return new ContentItemPage(this.get())
    }

    return page
  }
}

/**
 * Get the IIIF manifest URL for a page (https://example.com/iiif_id/info.json).
 */
export const getIIIFManifestUrl = (page: ContentItemPage, app: ImpressoApplication): string => {
  const { rewriteRules, baseUrl } = app.get('images')

  const originalUrl =
    (page.iiifManifest?.length ?? 0) === 0 ? getJSONUrl(page.uid, baseUrl) : getManifestJSONUrl(page.iiifManifest)

  return sanitizeIiifImageUrl(originalUrl, rewriteRules ?? [])
}

/**
 * Get the IIIF thumbnail URL for a page (https://example.com/iiif_id/full/150,/0/default.png).
 */
export const getIIIFThumbnailUrl = (
  page: ContentItemPage,
  app: ImpressoApplication,
  dimension: number = 150
): string => {
  const { rewriteRules, baseUrl } = app.get('images')

  const originalUrl =
    (page.iiifManifest?.length ?? 0) === 0
      ? getThumbnailUrl(page.uid, baseUrl, { dimension })
      : getExternalThumbnailUrl(page.iiifManifest, { dimension })

  return sanitizeIiifImageUrl(originalUrl, rewriteRules ?? [])
}
