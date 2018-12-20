// solr schema here.
// const Solr = require('feathers-solr')
// See http://docs.sequelizejs.com/en/latest/docs/models-definition/
// for more of what you can do here.
const Sequelize = require('sequelize');
const Language = require('./languages.model');
const Property = require('./properties.model');

class Newspaper {
  constructor({
    acronym = '',
    countArticles = -1,
    countIssues = -1,
    countPages = -1,
    deltaYear = -1,
    endYear = -1,
    name = '',
    startYear = -1,
    uid = '',
    labels = ['newspaper'],
    languages = [],
    properties = [],
  } = {}, complete = false) {
    this.uid = String(uid);

    this.acronym = acronym.length? String(acronym): this.uid ;
    this.name = String(name);
    this.labels = labels;
    this.endYear = parseInt(endYear, 10);
    this.startYear = parseInt(startYear, 10);

    this.deltaYear = this.endYear - this.startYear;

    this.languages = [];
    this.properties = [];

    // flatten languages, take codes only
    if (languages.length) {
      this.languages = languages.map(d => d.code);
    }

    // flatten properties, get prop value dict.
    if (properties.length) {
      properties.forEach((d) => {
        this.properties.push({
          [d.name]: d.newspapers_metadata.value,
        })
      });
    }

    if (complete) {
      this.countArticles = parseInt(countArticles, 10);
      this.countIssues = parseInt(countIssues, 10);
      this.countPages = parseInt(countPages, 10);
    }
  }


  static sequelize(client) {
    const language = Language.sequelize(client);
    const prop = Property.sequelize(client);

    const newspaper = client.define('newspaper', {
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
    }, {
      defaultScope: {
        include: [
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
      scopes: {
        findAll: {
          include: [
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
        get: {
          include: [
            {
              model: language,
              as: 'languages',
            },
          ],
        },
      },
    });

    newspaper.prototype.toJSON = function () {
      return new Newspaper({
        ... this.get()
      });
    };

    const newspaperMetadata = client.define('newspapers_metadata', {
      value: Sequelize.STRING,
    });

    newspaper.belongsToMany(language, {
      as: 'languages',
      through: 'newspapers_languages',
      foreignKey: 'newspaper_id',
    });
    language.belongsToMany(newspaper, {
      as: 'newspapers',
      through: 'newspapers_languages',
      foreignKey: 'language_id',
    });
    newspaper.belongsToMany(prop, {
      as: 'properties',
      through: newspaperMetadata,
      foreignKey: 'newspaper_id',
    });
    prop.belongsToMany(newspaper, {
      as: 'newspapers',
      through: newspaperMetadata,
      foreignKey: 'property_id',
    });

    return newspaper;
  }
}

module.exports = Newspaper;

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
