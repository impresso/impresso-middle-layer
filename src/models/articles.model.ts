import * as lodash from 'lodash'
import { DataTypes, Sequelize } from 'sequelize'
import { annotate, render, sliceAtSplitpoints, toExcerpt, toHierarchy } from '../helpers'
import { ImpressoApplication } from '../types'
import { OpenPermissions } from '../util/bigint'
import { getExternalFragmentUrl, getManifestJSONUrl } from '../util/iiif'
import { getRegionCoordinatesFromDocument } from '../util/solr'
import ArticleTopic from './articles-topics.model'
import CollectableItem from './collectable-items.model'
import Collection from './collections.model'
import { ContentItem } from './generated/schemas'
import Issue from './issues.model'
import Newspaper from './newspapers.model'
import Page from './pages.model'
import { LanguageCode, PrintContentItem, SupportedLanguageCodes } from './solr'
import { ContentItemTextMatch } from './generated/schemas/contentItem'

const ACCESS_RIGHT_NOT_SPECIFIED = 'na'

interface IArticleDPF {
  uid: string
  relevance: number | string
}

interface IArticleRegion {
  pageUid?: string
  g?: any[]
  c?: number[]
}

interface IBaseArticle {
  uid?: string
  type?: string
  title?: string
  excerpt?: string
  isCC?: boolean
  size?: number
  pages?: any[]
  persons?: ArticleDPF[]
  locations?: ArticleDPF[]
  collections?: string[]
}

export interface IFragmentsAndHighlights {
  fragments?: { [key: string]: any }
  highlighting?: { [key: string]: any }
}

interface IArticleOptions extends IBaseArticle {
  language?: string
  content?: string
  issue?: Issue | string
  dataProvider?: string
  newspaper?: Newspaper | string
  tags?: any[]
  country?: string
  year?: number | string
  date?: Date | string
  nbPages?: number | string
  isFront?: boolean
  accessRight?: ContentItem['accessRight']
  lb?: any[]
  rb?: any[]
  rc?: any[]
  mentions?: any[]
  topics?: any[]
  regionCoords?: any[]
  bitmapExplore?: bigint
  bitmapGetTranscript?: bigint
  bitmapGetImages?: bigint
  dataDomain?: ContentItem['dataDomain']
  copyright?: ContentItem['copyright']
}

class ArticleDPF {
  uid: string
  relevance: number

  constructor({ uid, relevance }: IArticleDPF = { uid: '', relevance: '' }) {
    this.uid = uid
    this.relevance = typeof relevance === 'string' ? parseFloat(relevance) : relevance
  }

  static solrDPFsFactory(dpfs: string[]): ArticleDPF[] {
    if (!dpfs || !dpfs.length) {
      return []
    }
    // console.log('solrDPFsFactory', dpfs);
    // eslint-disable-next-line max-len
    // dpfs = [ 'aida-0001-54-Paris|1 aida-0001-54-Pleven|1 aida-0001-54-Maurice_Bowra|1 aida-0001-54-China|1 aida-0001-54-Moscow|1 ' ]
    return dpfs[0]
      .trim()
      .split(' ')
      .map(d => {
        const parts = d.split('|')
        return new ArticleDPF({
          uid: parts[0],
          relevance: parts[1],
        })
      })
  }
}

class ArticleRegion {
  pageUid: string
  coords: number[]
  g: any[] = []
  isEmpty: boolean

  constructor({ pageUid = '', g = [], c = [] }: IArticleRegion = {}) {
    this.pageUid = String(pageUid)
    this.coords = c
    // TODO: Rendering now happens on the client side,
    // so this field is not used anymore. Consider removing later.
    if (g.length) {
      this.g = render(g)
    }
    this.isEmpty = g.length === 0
  }
}

class Fragment implements ContentItemTextMatch {
  fragment: string

  constructor(
    { fragment = '' }: ContentItemTextMatch = {
      fragment: '',
    }
  ) {
    this.fragment = String(fragment)
  }
}

class ArticleMatch extends Fragment implements ContentItemTextMatch {
  coords: number[]
  pageUid: string

  constructor(
    { coords = [], fragment = '', pageUid = '' }: ContentItemTextMatch = {
      coords: [],
      fragment: '',
      pageUid: '',
    }
  ) {
    super({ fragment })
    this.coords = coords.map(coord => (typeof coord == 'string' ? parseInt(coord, 10) : coord))
    this.pageUid = String(pageUid)
  }
}

/**
 * @deprecated use `content-item` instead.
 */
export class BaseArticle implements Omit<ContentItem, 'labels' | 'year' | 'id'> {
  uid: string
  type: string
  title: string
  size: number
  nbPages: number
  pages: any[]
  isCC: boolean
  excerpt: string
  collections?: string[]
  persons?: ArticleDPF[]
  locations?: ArticleDPF[]

  constructor({
    uid = '',
    type = '',
    title = '',
    excerpt = '',
    isCC = false,
    size = 0,
    pages = [],
    persons = [],
    locations = [],
    collections = [],
  }: IBaseArticle = {}) {
    this.uid = String(uid)
    this.type = String(type)
    this.title = String(title).trim()
    this.size = typeof size === 'string' ? parseInt(size, 10) : size
    this.nbPages = pages.length
    this.pages = pages
    this.isCC = isCC

    let prefix
    if (!this.title.length && excerpt.length) {
      this.title = toExcerpt(excerpt, {
        TruncateLength: 5,
        Suffix: '',
      })
      prefix = '...'
    }

    this.excerpt = toExcerpt(excerpt, {
      TruncateLength: 50,
      excludeTitle: this.title,
    })

    if (prefix) {
      this.excerpt = [prefix, this.excerpt].join('')
    }

    if (collections.length) {
      this.collections = collections
    }
    if (persons.length) {
      this.persons = persons
    }
    if (locations.length) {
      this.locations = locations
    }
  }

  /**
   * Return an Article mapper for Solr response document
   */
  static solrFactory(res: PrintContentItem & IFragmentsAndHighlights): (doc: PrintContentItem) => BaseArticle {
    const fragments = res.fragments || {}
    return doc =>
      new BaseArticle({
        uid: doc.id,
        type: doc.item_type_s,
        size: doc.content_length_i,
        pages: (doc.page_id_ss || []).map(uid => ({
          uid,
          num: parseInt(uid.match(/p([0-9]+)$/)?.[1] ?? '', 10),
        })),
        isCC: !!doc.cc_b,
        // eslint-disable-next-line no-use-before-define
        title: Article.getUncertainField(doc, 'title'),
        persons: ArticleDPF.solrDPFsFactory(doc.pers_entities_dpfs ?? []),
        locations: ArticleDPF.solrDPFsFactory(doc.loc_entities_dpfs ?? []),
        // collections: doc.ucoll_ss,
        excerpt: doc.snippet_plain || lodash.get(fragments[doc.id], 'nd[0]', ''),
      })
  }
}

type ContentItemWithCorrectTypes = Omit<
  ContentItem,
  'issue' | 'date' | 'bitmapExplore' | 'bitmapGetTranscript' | 'bitmapGetImages' | 'topics' | 'id'
> & {
  uid: string
  issue?: Issue
  date?: Date
  bitmapExplore?: bigint
  bitmapGetTranscript?: bigint
  bitmapGetImages?: bigint
  topics?: ArticleTopic[]
}

/**
 * @deprecated use `content-item` instead.
 */
export class Article extends BaseArticle implements ContentItemWithCorrectTypes {
  language: string
  content: string
  issue?: Issue
  dataProvider?: string
  newspaper: Newspaper
  tags: any[]
  country: string
  year: number
  date: Date
  isFront: boolean
  accessRight: ContentItem['accessRight']
  labels: 'article'[]
  mentions?: any[]
  topics?: ArticleTopic[]
  regions?: ArticleRegion[]
  contentLineBreaks: any[]
  regionBreaks: any[]
  matches?: (ArticleMatch | Fragment)[]
  bitmapExplore?: bigint
  bitmapGetTranscript?: bigint
  bitmapGetImages?: bigint
  dataDomain?: ContentItem['dataDomain']
  copyright?: ContentItem['copyright']

  constructor({
    uid = '',
    type = '',
    language = '',
    title = '',
    excerpt = '',
    content = '',
    size = 0,
    issue = undefined,
    dataProvider = undefined,
    newspaper = undefined,
    pages = [],
    collections = [],
    tags = [],
    country = '',
    year = 0,
    date = new Date(),
    nbPages = 0,
    isFront = false,
    isCC = false,
    accessRight = ACCESS_RIGHT_NOT_SPECIFIED,
    lb = [],
    rb = [],
    rc = [],
    mentions = [],
    topics = [],
    persons = [],
    locations = [],
    regionCoords = [],
    bitmapExplore = undefined,
    bitmapGetTranscript = undefined,
    bitmapGetImages = undefined,
    dataDomain = undefined,
    copyright = undefined,
  }: IArticleOptions = {}) {
    super({
      uid,
      type,
      title,
      excerpt,
      isCC,
      size,
      pages,
      persons,
      locations,
      collections,
    })

    this.language = String(language)
    this.content = String(content)

    if (excerpt) {
      this.excerpt = String(excerpt)
    } else if (this.content.length) {
      this.excerpt = toExcerpt(this.content, {
        TruncateLength: 20,
        excludeTitle: this.title,
      })
    } else {
      this.excerpt = ''
    }

    if (issue instanceof Issue) {
      this.issue = issue
    } else if (issue) {
      this.issue = new Issue({ uid: issue })
    }

    this.dataProvider = dataProvider

    if (newspaper instanceof Newspaper) {
      this.newspaper = newspaper
    } else {
      this.newspaper = new Newspaper({ uid: newspaper })
    }

    this.collections = collections
    this.tags = tags

    this.country = String(country)
    this.year = typeof year === 'string' ? parseInt(year, 10) : year
    this.date = date instanceof Date ? date : new Date(date)

    // stats
    this.nbPages = typeof nbPages === 'string' ? parseInt(nbPages, 10) : nbPages
    this.isFront = !!isFront
    this.isCC = !!isCC
    this.accessRight = accessRight
    // TODO: based on type!
    this.labels = ['article']

    if (mentions.length) {
      this.mentions = mentions.filter(mention => mention != null)
    }

    if (topics.length) {
      this.topics = topics
    }

    if (persons.length) {
      this.persons = persons
    }

    if (locations.length) {
      this.locations = locations
    }

    if (regionCoords.length) {
      this.regions = Article.getRegions({})
    }
    this.contentLineBreaks = lb
    this.regionBreaks = rb

    this.enrich(rc, lb, rb)

    this.bitmapExplore = bitmapExplore
    this.bitmapGetTranscript = bitmapGetTranscript
    this.bitmapGetImages = bitmapGetImages

    this.dataDomain = dataDomain
    this.copyright = copyright
  }

  enrich(rc: any[], lb: any[], rb: any[]): void {
    // get regions from rc field:
    // rc is a list of page objects, containing a r property
    // which contains an array of coordinates [x,y,w,h]
    // this reduce function returns something like:
    //  const rcs = [
    //    { page_uid: 'GDL-1900-08-08-a-p0002',
    //      c: [ 3433, 1440, 783, 42 ] },
    //    { page_uid: 'GDL-1900-08-08-a-p0002',
    //      c: [ 3433, 1481, 783, 571 ] }
    //  ]
    const rcs = rc.reduce(
      (acc, pag) =>
        acc.concat(
          pag.r.map((reg: any) => ({
            pageUid: pag.id,
            c: reg,
          }))
        ),
      []
    )

    // if there are line breaks and region breaks ...
    if (rc.length && this.content.length) {
      // tokenize the content based on line breaks
      const tokens = sliceAtSplitpoints(this.content, lb)
      // text regions, grouped thanks to region splipoints
      const trs = toHierarchy(tokens, rb)

      // annotated wit mentions...
      if (this.mentions && this.mentions.length) {
        this.mentions
          .filter(d => d !== null)
          .forEach(group => {
            const category = Object.keys(group)[0]
            group[category].forEach((token: any[]) => {
              annotate(tokens, category, token[0], token[0] + token[1], 'class')
            })
          })
      }

      if (rcs.length < trs.length) {
        // it would never happen.... or not?
        throw new Error(`article ${this.uid} coordinates corrupted`)
      }

      // then, for each region,
      // we add the corresponding regionCoords, if any
      // this.regions = this.regions.map()
      for (let i = 0, l = trs.length; i < l; i += 1) {
        Object.assign(trs[i], rcs[i])
      }
      this.regions = trs.map(d => new ArticleRegion(d))
    } else {
      this.regions = rcs.map((d: any) => new ArticleRegion(d))
    }
    // console.log(this.regions);
    //
  }

  static assignIIIF(article: Article, props: string[] = ['regions', 'matches']): Article {
    // get iiif of pages
    const pagesIndex = lodash.keyBy(article.pages, 'uid') // d => d.iiif);
    props.forEach(prop => {
      const a = article as any
      if (Array.isArray(a[prop])) {
        a[prop].forEach((d: any, i) => {
          if (pagesIndex[a[prop][i].pageUid]) {
            a[prop][i].iiifFragment = getExternalFragmentUrl(pagesIndex[a[prop][i].pageUid].iiif, {
              coordinates: d.coords,
            })
          }
        })
      }
    })
    return article
  }

  /**
   * get regions from pp_plain field, aka region coordinates.
   * Te param `regionCoords` is a list of page objects, containing a r property
   * which contains an array of coordinates [x,y,w,h]
   * this reduce function returns something like:
   *  const regions = [
   *    { page_uid: 'GDL-1900-08-08-a-p0002',
   *      c: [ 3433, 1440, 783, 42 ] },
   *    { page_uid: 'GDL-1900-08-08-a-p0002',
   *      c: [ 3433, 1481, 783, 571 ] }
   *  ][getPageRegions description]
   * @param  {Array}  regionCoords=[]
   * @return {Array}  List of ArticleRegion
   */
  static getRegions({ regionCoords = [] }: { regionCoords?: any[] }): ArticleRegion[] {
    return regionCoords.reduce(
      (acc, pag) =>
        acc.concat(
          pag.r.map(
            (reg: any) =>
              new ArticleRegion({
                pageUid: pag.id,
                c: reg,
              })
          )
        ),
      []
    )
  }

  /**
   * Given a solr document containing pp_plain, it
   * merges info coming from SOLR select api to create
   * ArticleMatch instances
   *
   * @param  {Object} solrDocument    [description]
   * @param  {Array}  [fragments=[]]  [description]
   * @param  {Object} [highlights={}] [description]
   * @return {Array}                 Array of ArticleMatch matches
   */
  static getMatches({
    solrDocument,
    fragments = [],
    highlights = {},
  }: {
    solrDocument?: any
    fragments?: string[]
    highlights?: any
  } = {}): ContentItemTextMatch[] {
    if (!solrDocument.pp_plain || !highlights || !highlights.offsets || !highlights.offsets.length) {
      return fragments.map(fragment => new Fragment({ fragment }))
    }
    return highlights.offsets
      .map((pos: any, i: number) => {
        // for each offset
        let match = undefined
        // find in page
        solrDocument.pp_plain.forEach((pag: any) => {
          for (let l = pag.t.length, ii = 0; ii < l; ii += 1) {
            // if the token start at position and the token length is
            // the one described in pos. Really complicated.
            if (pos[0] === pag.t[ii].s && pag.t[ii].l === pos[1] - pos[0]) {
              // console.log('FFFFOUND', pag.id, pag.t[ii], pos[0]);
              match = new ArticleMatch({
                fragment: fragments[i],
                coords: pag.t[ii].c,
                pageUid: pag.id,
              })
              break
            }
          }
        })
        return match
      })
      .filter((d: any) => d)
  }

  static sequelize(client: Sequelize, app: ImpressoApplication) {
    const page = Page.sequelize(client)
    const collection = Collection.sequelize(client)
    const collectableItem = CollectableItem.sequelize(client)

    const article = client.define(
      'article',
      {
        uid: {
          type: DataTypes.STRING(50),
          primaryKey: true,
          field: 'id',
          unique: true,
        },
        v: {
          type: DataTypes.STRING(50),
          field: 's3_version',
        },
        creationDate: {
          type: DataTypes.DATE,
          field: 'created',
        },
      },
      {
        tableName: app.get('sequelize').tables!.articles!,
        scopes: {
          get: {
            include: [
              {
                model: page,
                as: 'pages',
              },
            ],
          },
          getCollections: {
            include: [
              {
                model: collection,
                as: 'collections',
              },
            ],
          },
        },
      }
    )

    article.prototype.toJSON = function () {
      return new Article({
        ...this.get(),
        // newspaper: this.newspaper ? this.newspaper.toJSON() : null,
        // pages: this.pages ? this.pages.map(p => p.toJSON()) : [],
      })
    }

    // article.belongsTo(newspaper, {
    //   foreignKey: {
    //     fieldName: 'newspaper_id',
    //   },
    // });

    article.belongsToMany(collection, {
      as: 'collections',
      through: collectableItem,
      foreignKey: 'item_id',
      otherKey: 'collection_id',
    })

    article.belongsToMany(page, {
      as: 'pages',
      through: 'page_contentItem',
      foreignKey: 'content_item_id',
      otherKey: 'page_id',
    })

    return article
  }

  /**
   * Given a solr document representing an article, return the value according to the field name
   * when the field is declined multilanguage (eg when you have content_txt_de or
   * content_txt_fr and you only care about some `content`)
   *
   * @param  {Object} doc   [description]
   * @param  {String} field field name, without the `_txt_<language>` suffix
   * @param  {Array}  langs =['fr', 'de', 'en'] Array of language suffixes
   * @return {String}       the field value
   */
  static getUncertainField(
    doc: PrintContentItem,
    field: 'title' | 'content',
    langs: LanguageCode[] = SupportedLanguageCodes
  ): string {
    const langCode = doc.lg_s! as LanguageCode
    let value = doc[`${field}_txt_${langCode}`]

    if (!value) {
      for (let i = 0, l = langs.length; i < l; i += 1) {
        value = doc[`${field}_txt_${langs[i]}`]
        if (value) {
          break
        }
      }
    }
    return value
  }

  static solrFactory(res: PrintContentItem & IFragmentsAndHighlights): (doc: PrintContentItem) => Article {
    return doc => {
      // region coordinates may be loaded directly from the new field rc_plains
      const rc = getRegionCoordinatesFromDocument(doc)

      const art = new Article({
        uid: doc.id,
        type: doc.item_type_s,
        language: doc.lg_s,

        excerpt: doc.snippet_plain,
        title: Article.getUncertainField(doc, 'title'),
        content: Article.getUncertainField(doc, 'content'),
        size: doc.content_length_i,

        dataProvider: doc.meta_partnerid_s,

        newspaper: new Newspaper({
          uid: doc.meta_journal_s,
        }),
        issue: new Issue({
          uid: doc.meta_issue_id_s,
        }),

        country: doc.meta_country_code_s,
        year: doc.meta_year_i,
        date: new Date(doc.meta_date_dt),
        // prettier-ignore
        pages: Array.isArray(doc.page_id_ss)
          ? doc.page_id_ss.map((d, i) =>
            new Page({
              uid: d,
            })
          )
          : [],
        nbPages: doc.nb_pages_i,
        // front_b
        isFront: doc.front_b,
        // has reliable coordinates force as boolean
        isCC: !!doc.cc_b,

        lb: typeof doc.lb_plain === 'string' ? JSON.parse(doc.lb_plain) : doc.lb_plain,
        rb: typeof doc.rb_plain === 'string' ? JSON.parse(doc.rb_plain) : doc.rb_plain,

        rc: rc,
        // accessRight
        /**
         * @deprecated removed in Impresso 2.0. New field: rights_data_domain_s
         * https://github.com/impresso/impresso-middle-layer/issues/462
         */
        accessRight: ACCESS_RIGHT_NOT_SPECIFIED,
        mentions: typeof doc.nem_offset_plain === 'string' ? JSON.parse(doc.nem_offset_plain) : doc.nem_offset_plain,
        topics: ArticleTopic.solrDPFsFactory(doc.topics_dpfs ?? []),
        persons: ArticleDPF.solrDPFsFactory(doc.pers_entities_dpfs ?? []),
        locations: ArticleDPF.solrDPFsFactory(doc.loc_entities_dpfs ?? []),
        // collections: doc.ucoll_ss ?? [],
        // permissions bitmaps
        // if it's not defined, set max permissions for compatibility
        // with old Solr version
        bitmapExplore: BigInt(doc.rights_bm_explore_l ?? OpenPermissions),
        bitmapGetTranscript: BigInt(doc.rights_bm_get_tr_l ?? OpenPermissions),
        bitmapGetImages: BigInt(doc.rights_bm_get_img_l ?? OpenPermissions),

        dataDomain: doc.rights_data_domain_s,
        copyright: doc.rights_copyright_s,
      })

      if (!doc.pp_plain) {
        return art
      }
      // get text matches
      const fragments = res.fragments?.[art.uid]?.[`content_txt_${art.language}`]
      const highlights = res.highlighting?.[art.uid]?.[`content_txt_${art.language}`]
      //
      // console.log('fragments!!', res.fragments, '--', fragments);
      // console.log('highlights!!', res.highlighting, '--', highlights);
      // console.log(doc.pp_plain);
      if (!highlights) {
        return art
      }

      art.matches = Article.getMatches({
        solrDocument: doc,
        fragments,
        highlights,
      })

      return art
    }
  }
}

export default Article
export const solrFactory = Article.solrFactory
