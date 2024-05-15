// solr schema here.
// const Solr = require('feathers-solr')
// See http://docs.sequelizejs.com/en/latest/docs/models-definition/
// for more of what you can do here.
const Sequelize = require('sequelize')
const Language = require('./languages.model')
const Property = require('./properties.model')
const newspapersIndex = require('../data')('newspapers')

class Newspaper {
  constructor({
    acronym = '',
    countArticles = -1,
    countIssues = -1,
    countPages = -1,
    endYear = -1,
    name = '',
    startYear = -1,
    uid = '',
    labels = ['newspaper'],
    languages = [],
    properties = [],
    stats = {},
  } = {}) {
    this.uid = String(uid)
    this.acronym = acronym.length ? String(acronym) : this.uid
    this.labels = labels
    this.languages = languages.map(d => d.code)
    this.properties = properties
    this.included = stats.startYear !== null

    const indexed = newspapersIndex.getValue(this.uid)

    if (indexed) {
      this.name = indexed.name
      this.endYear = indexed.endYear != null ? parseInt(indexed.endYear, 10) : null
      this.startYear = indexed.startYear != null ? parseInt(indexed.startYear, 10) : null
      this.firstIssue = indexed.firstIssue
      this.lastIssue = indexed.lastIssue
      this.languages = indexed.languages
      this.countArticles = parseInt(indexed.countArticles, 10)
      this.countIssues = parseInt(indexed.countIssues, 10)
      this.countPages = parseInt(indexed.countPages, 10)
      this.fetched = true
    } else {
      this.name = String(name)
      this.endYear = endYear != null ? parseInt(endYear, 10) : null
      this.startYear = startYear != null ? parseInt(startYear, 10) : null
      this.countArticles = parseInt(countArticles, 10)
      this.countIssues = parseInt(countIssues, 10)
      this.countPages = parseInt(countPages, 10)
    }

    if (this.endYear != null && this.startYear != null) {
      this.deltaYear = this.endYear - this.startYear
    } else {
      this.deltaYear = 0
    }
  }

  // TODO: when cache is moved to Redis this will become an async function
  static getCached(uid) {
    return new Newspaper(newspapersIndex.getValue(uid))
  }

  static sequelize(client) {
    const language = Language.sequelize(client)
    const prop = Property.sequelize(client)
    const stats = client.define(
      'stats',
      {
        startYear: {
          type: Sequelize.SMALLINT,
          field: 'start',
        },
        endYear: {
          type: Sequelize.SMALLINT,
          field: 'end',
        },
        countIssues: {
          type: Sequelize.INTEGER,
          field: 'number_issues',
        },
      },
      {
        tableName: 'np_timespan_v',
      }
    )
    stats.removeAttribute('id')

    const newspaper = client.define(
      'newspaper',
      {
        uid: {
          type: Sequelize.STRING,
          primaryKey: true,
          unique: true,
          field: 'id',
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          field: 'title',
        },
        startYear: {
          type: Sequelize.SMALLINT,
          field: 'start_year',
        },
        endYear: {
          type: Sequelize.SMALLINT,
          field: 'end_year',
        },
      },
      {
        scopes: {
          lookup: {
            include: [],
          },
          findAll: {
            include: [
              {
                model: stats,
                as: 'stats',
              },
              {
                model: language,
                as: 'languages',
              },
              {
                model: prop,
                as: 'properties',
              },
            ],
          },
          find: {
            include: [
              {
                model: stats,
                as: 'stats',
              },
            ],
          },
          get: {
            include: [
              {
                model: stats,
                as: 'stats',
              },
              {
                model: language,
                as: 'languages',
              },
              {
                model: prop,
                as: 'properties',
              },
            ],
          },
        },
      }
    )

    newspaper.prototype.toJSON = function () {
      return new Newspaper(this.get())
    }

    const newspaperMetadata = client.define('newspapers_metadata', {
      value: Sequelize.STRING,
    })

    newspaper.hasOne(stats, {
      as: 'stats',
      foreignKey: 'newspaper_id',
    })

    newspaper.belongsToMany(language, {
      as: 'languages',
      through: 'newspapers_languages',
      foreignKey: 'newspaper_id',
    })
    language.belongsToMany(newspaper, {
      as: 'newspapers',
      through: 'newspapers_languages',
      foreignKey: 'language_id',
    })
    newspaper.belongsToMany(prop, {
      as: 'properties',
      through: newspaperMetadata,
      foreignKey: 'newspaper_id',
    })
    prop.belongsToMany(newspaper, {
      as: 'newspapers',
      through: newspaperMetadata,
      foreignKey: 'property_id',
    })

    return newspaper
  }
}

module.exports = Newspaper

// module.exports = function (app) {
//   const config = app.get('sequelize');
//   const newspaper = model(app.get('sequelizeClient'), {
//     tableName: config.tables.newspapers,
//     hooks: {
//       beforeCount(options) {
//         options.raw = true;
//       },
//     },
//   });
//
//   return {
//     sequelize: newspaper,
//   };
// };
