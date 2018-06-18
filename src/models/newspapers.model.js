// solr schema here.
// const Solr = require('feathers-solr')
// See http://docs.sequelizejs.com/en/latest/docs/models-definition/
// for more of what you can do here.
const Sequelize = require('sequelize');
const Language = require('./languages.model').model;
const Property = require('./properties.model').model;


const model = (client, options = {}) => {
  const language = Language(client);
  const prop = Property(client);

  const newspaper = client.define('newspaper', {
    uid: {
      type: Sequelize.STRING,
      primaryKey: true,
      unique: true,
      field: 'id',
    },
    title: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    start_year: {
      type: Sequelize.SMALLINT,
    },
    end_year: {
      type: Sequelize.SMALLINT,
    },
  }, {
    ...options,
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
    const item = this.get();
    // flatten languages
    if (item.languages && Array.isArray(item.languages)) {
      item.languages = item.languages.map(d => d.code);
    }
    if (item.properties && Array.isArray(item.properties)) {
      item.properties.forEach((d) => {
        item[d.name] = d.newspapers_metadata.value;
      });
      delete item.properties;
    }
    return item;
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
  // newspaper.addScope('findAll', {
  //   include: [
  //     {
  //       model: language,
  //       as: 'languages'
  //     }
  //   ]
  // })
  return newspaper;
};

module.exports = function (app) {
  const config = app.get('sequelize');
  const newspaper = model(app.get('sequelizeClient'), {
    tableName: config.tables.newspapers,
    hooks: {
      beforeCount(options) {
        options.raw = true;
      },
    },
  });

  return {
    sequelize: newspaper,
  };
};

module.exports.model = model;
