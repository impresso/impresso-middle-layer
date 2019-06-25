const Sequelize = require('sequelize');
const Newspaper = require('./newspapers.model');
const Issue = require('./issues.model');
const ArticleEntity = require('./articles-entities.model');
const ArticleTag = require('./articles-tags.model');
const { getJSON, getThumbnail } = require('../hooks/iiif.js');

class Page {
  constructor({
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
  } = {}, complete = false) {
    this.uid = String(uid);

    // "LCE-1864-07-17-a-p0004".match(/(([^-]*)-\d{4}-\d{2}-\d{2}-[a-z])*-p0*([0-9]+)/)
    const [, issueUid, newspaperUid, num] = this.uid
      .match(/(([^-]*)-\d{4}-\d{2}-\d{2}-[a-z])*-p0*([0-9]+)/);

    this.num = parseInt(num, 10);
    this.issueUid = issueUid;
    this.newspaperUid = newspaperUid;

    // if any is provided
    this.iiif = getJSON(this.uid);
    this.iiifThumbnail = getThumbnail(this.uid);

    this.labels = labels;

    if (countArticles > -1) {
      this.countArticles = parseInt(countArticles, 10);
    }

    this.hasCoords = Boolean(hasCoords);
    this.hasErrors = Boolean(hasErrors);

    // if (issue_uid) {
    //   this.issueUid = issue_uid;
    // }
    //
    // if (newspaper_uid) {
    //   this.newspaper = Newspaper.getCached(newspaper_uid);
    // } else {
    //   // get newspaper uid from uid.
    //
    // }

    if (complete) {
      this.articlesEntities = articlesEntities.map((d) => {
        if (d instanceof ArticleEntity) { return d; }
        return new ArticleEntity(d);
      });

      this.articlesTags = articlesTags.map((d) => {
        if (d instanceof ArticleTag) { return d; }
        return new ArticleTag(d);
      });

      this.collections = collections;
    }
  }

  static sequelize(client) {
    const newspaper = Newspaper.sequelize(client);
    const issue = Issue.sequelize(client);

    const page = client.define('page', {
      uid: {
        type: Sequelize.STRING,
        primaryKey: true,
        field: 'id',
        unique: true,
      },
      issue_uid: {
        type: Sequelize.STRING,
        field: 'issue_id',
      },
      num: {
        type: Sequelize.SMALLINT,
        field: 'page_number',
      },
      hasCoords: {
        type: Sequelize.SMALLINT,
        field: 'has_converted_coordinates',
      },
      hasErrors: {
        type: Sequelize.SMALLINT,
        field: 'has_corrupted_json',
      },
    }, {
      scopes: {
        findAll: {
          include: [
            {
              model: issue,
              as: 'issue',
            },
          ],
        },
      },
    });

    page.belongsTo(issue, {
      foreignKey: 'issue_id',
    });

    page.prototype.toJSON = function () {
      return new Page(this.get());
    };

    return page;
  }
}


module.exports = Page;
