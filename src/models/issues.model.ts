import Sequelize from 'sequelize'
import Newspaper from './newspapers.model'
import { NewspaperIssue } from './generated/schemas'
import { ArticleFields, ContentItemCore, ContextualMetadataFields } from './generated/solr/ContentItem'

const ACCESS_RIGHTS_ND = 'NotDefined'
const ACCESS_RIGHTS_CLOSED = 'Closed'
const ACCESS_RIGHTS_OPEN_PUBLIC = 'OpenPublic'
const ACCESS_RIGHTS_OPEN_PRIVATE = 'OpenPrivate'
const ACCESS_RIGHTS = [ACCESS_RIGHTS_ND, ACCESS_RIGHTS_CLOSED, ACCESS_RIGHTS_OPEN_PUBLIC, ACCESS_RIGHTS_OPEN_PRIVATE]

interface IIssueOptions {
  newspaper?: Newspaper | string
  pages?: any[]
  cover?: string
  frontPage?: any
  uid?: string
  labels?: string[]
  accessRights?: string
}

class Issue implements Omit<NewspaperIssue, 'date'> {
  uid: string
  cover: string
  labels: string[]
  frontPage?: any
  fresh: boolean
  accessRights: string
  date?: Date
  year?: string
  newspaper?: Newspaper
  pages?: any[]

  constructor({
    newspaper,
    pages = [],
    cover = '',
    frontPage = null,
    uid = '',
    labels = ['issue'],
    accessRights = ACCESS_RIGHTS_ND,
  }: IIssueOptions = {}) {
    this.uid = String(uid)
    this.cover = cover
    this.labels = labels
    if (frontPage) {
      this.frontPage = frontPage
    }
    const issueDateFromUid = this.uid.match(/(\d{4})-\d{2}-\d{2}/)

    this.fresh = accessRights !== ACCESS_RIGHTS_ND

    if (ACCESS_RIGHTS.indexOf(accessRights) !== -1) {
      this.accessRights = accessRights
    } else {
      this.accessRights = ACCESS_RIGHTS_CLOSED
    }
    if (issueDateFromUid) {
      this.date = new Date(issueDateFromUid[0])
      this.year = issueDateFromUid[1]
    }

    if (newspaper instanceof Newspaper) {
      this.newspaper = newspaper
    }

    if (pages.length) {
      this.pages = pages
    }
  }

  /**
   * Return an Issue mapper for Solr response document
   * Issues are rebuilt from SOLR "articles" documents.
   *
   * @return {function} {Issue} issue instance.
   */
  static solrFactory() {
    return (doc: ContentItemCore & ArticleFields) => {
      const iss = new Issue({
        uid: doc.meta_issue_id_s,
        cover: doc.page_id_ss ? doc.page_id_ss[0] : undefined,
        newspaper: doc.meta_journal_s,
      })
      return iss
    }
  }

  static sequelize(client: Sequelize.Sequelize) {
    const newspaper = Newspaper.sequelize(client)
    const issue = client.define(
      'issue',
      {
        uid: {
          type: Sequelize.STRING,
          primaryKey: true,
          field: 'id',
          unique: true,
        },
        newspaper_uid: {
          type: Sequelize.STRING,
          field: 'newspaper_id',
        },
        year: {
          type: Sequelize.SMALLINT,
        },
        month: {
          type: Sequelize.SMALLINT,
        },
        day: {
          type: Sequelize.SMALLINT,
        },
        accessRights: {
          type: Sequelize.STRING,
          field: 'access_rights',
        },
      },
      {
        scopes: {
          get: {
            include: [
              {
                model: newspaper,
                as: 'newspaper',
              },
            ],
          },
          findAll: {
            include: [
              {
                model: newspaper,
                as: 'newspaper',
              },
            ],
          },
        },
      }
    )

    issue.prototype.toJSON = function () {
      return new Issue({
        ...this.get(),
      })
    }

    issue.belongsTo(newspaper, {
      foreignKey: 'newspaper_id',
    })

    return issue
  }
}

const ISSUE_SOLR_FL_MINIMAL = ['meta_issue_id_s', 'meta_journal_s', 'meta_issue_id_s', 'cc_b', 'front_b', 'page_id_ss']

export default Issue
export { ISSUE_SOLR_FL_MINIMAL, ACCESS_RIGHTS_CLOSED, ACCESS_RIGHTS_OPEN_PUBLIC, ACCESS_RIGHTS_OPEN_PRIVATE }
