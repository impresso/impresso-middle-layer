const Sequelize = require('sequelize');
const Newspaper = require('./newspapers.model');

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
    uid = '',
    labels = ['issue'],
  } = {}) {
    this.uid = String(uid);
    this.cover = cover;
    this.labels = labels;

    const issueDateFromUid = this.uid.match(/\d{4}-\d{2}-\d{2}/);

    if (issueDateFromUid) {
      this.date = new Date(issueDateFromUid[0]);
    }

    if (newspaper instanceof Newspaper) {
      this.newspaper = newspaper;
    } else if (newspaper) {
      this.newspaper = new Newspaper(newspaper);
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
        cover: doc.page_id_ss[0],
        newspaper: new Newspaper({
          uid: doc.meta_journal_s,
        }),
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
