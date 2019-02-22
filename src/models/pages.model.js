const Sequelize = require('sequelize');
const Newspaper = require('./newspapers.model');
const Issue = require('./issues.model');
const ArticleEntity = require('./articles-entities.model');
const ArticleTag = require('./articles-tags.model');


class Page {
  constructor({
    uid = '',
    iiif = '',
    labels = ['page'],
    num = 0,
    // converted coordinates
    hasCC = false,
    // number of articles
    countArticles = 0,

    // All user ArticleTag instances on this pages
    articlesTags = [],

    // top 20 ArticleEntity intances
    articlesEntities = [],

    // All collections for this page
    collections = [],
  } = {}, complete = false) {
    this.uid = String(uid);

    // if default is 0, then get page number from uid
    if (num === 0) {
      this.num = this.uid.match(/p0*([0-9]+)$/)[1];
    } else {
      this.num = parseInt(num, 10);
    }
    // if any is provided
    this.iiif = String(iiif);
    this.labels = labels;
    this.countArticles = parseInt(countArticles, 10);
    this.hasCC = Boolean(hasCC);

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
    const newspaper = Newspaper.model(client);
    const issue = Issue.model(client);

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
      newspaper_uid: {
        type: Sequelize.STRING,
        field: 'newspaper_id',
      },
      page_number: {
        type: Sequelize.SMALLINT,
        field: 'page_number',
      },
    }, {
      scopes: {
        findAll: {
          include: [
            {
              model: newspaper,
              as: 'newspaper',
            },
            {
              model: issue,
              as: 'issue',
            },
          ],
        },
      },
    });

    page.belongsTo(newspaper, {
      foreignKey: 'newspaper_id',
    });

    page.belongsTo(issue, {
      foreignKey: 'issue_id',
    });

    return page;
  }
}


module.exports = Page;
