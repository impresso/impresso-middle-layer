const Sequelize = require('sequelize');
const Newspaper = require('./newspapers.model');

const ACCESS_RIGHTS_ND = 'NotDefined';
const ACCESS_RIGHTS_CLOSED = 'Closed';
const ACCESS_RIGHTS_OPEN_PUBLIC = 'OpenPublic';
const ACCESS_RIGHTS_OPEN_PRIVATE = 'OpenPrivate';
const ACCESS_RIGHTS = [
  ACCESS_RIGHTS_ND,
  ACCESS_RIGHTS_CLOSED,
  ACCESS_RIGHTS_OPEN_PUBLIC,
  ACCESS_RIGHTS_OPEN_PRIVATE,
];

class Issue {
  constructor({
    // collections = [],
    // countArticles = 0,
    // countPages = 0,
    // date = new Date(),
    // entities = [],
    newspaper,
    pages = [],
    cover = '', // page uid
    frontPage = null,
    uid = '',
    labels = ['issue'],
    accessRights = ACCESS_RIGHTS_ND,
  } = {}) {
    this.uid = String(uid);
    this.cover = cover;
    this.labels = labels;
    if (frontPage) {
      this.frontPage = frontPage;
    }
    const issueDateFromUid = this.uid.match(/(\d{4})-\d{2}-\d{2}/);

    this.fresh = accessRights !== ACCESS_RIGHTS_ND;

    if (ACCESS_RIGHTS.indexOf(accessRights) !== -1) {
      this.accessRights = accessRights;
    } else {
      this.accessRights = ACCESS_RIGHTS_CLOSED;
    }
    if (issueDateFromUid) {
      this.date = new Date(issueDateFromUid[0]);
      this.year = issueDateFromUid[1];
    }

    if (newspaper instanceof Newspaper) {
      this.newspaper = newspaper;
    } else if (newspaper) {
      this.newspaper = Newspaper.getCached(newspaper);
    }

    if (pages.length) {
      this.pages = pages;
    }
  }

  /**
   * Return an Issue mapper for Solr response document
   * Issues are rebuilt from SOLR "articles" documents.
   *
   * @return {function} {Issue} issue instance.
   */
  static solrFactory() {
    return (doc) => {
      const iss = new Issue({
        uid: doc.meta_issue_id_s,
        cover: doc.page_id_ss ? doc.page_id_ss[0] : undefined,
        newspaper: doc.meta_journal_s,
      });
      return iss;
    };
  }

  static sequelize(client) {
    const newspaper = Newspaper.sequelize(client);
    const issue = client.define('issue', {
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
    }, {
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
    });

    issue.prototype.toJSON = function () {
      return new Issue({
        ...this.get(),
      });
    };

    issue.belongsTo(newspaper, {
      foreignKey: 'newspaper_id',
    });

    return issue;
  }
}

const ISSUE_SOLR_FL_MINIMAL = [
  'meta_issue_id_s',
  'meta_journal_s',
  'meta_issue_id_s',
  'cc_b',
  'front_b',
  'page_id_ss',
];

module.exports = Issue;
module.exports.ISSUE_SOLR_FL_MINIMAL = ISSUE_SOLR_FL_MINIMAL;
module.exports.ACCESS_RIGHTS_CLOSED = ACCESS_RIGHTS_CLOSED;
module.exports.ACCESS_RIGHTS_OPEN_PUBLIC = ACCESS_RIGHTS_OPEN_PUBLIC;
module.exports.ACCESS_RIGHTS_OPEN_PRIVATE = ACCESS_RIGHTS_OPEN_PRIVATE;
