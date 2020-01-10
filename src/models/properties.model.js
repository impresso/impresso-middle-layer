const { DataTypes } = require('sequelize');


class Property {
  constructor({
    name = '',
    // eslint-disable-next-line camelcase
    newspapers_metadata = {},
  } = {}) {
    this.name = name;
    this.value = newspapers_metadata.value;
    if (!this.value) {
      console.warn('Property', name, 'doesn\'t have a value', newspapers_metadata.get());
    }
    if (this.value && this.value.match(/https?:\/\//)) {
      this.isUrl = true;
    }
  }


  static sequelize(client) {
    const prop = client.define('prop', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
      },
      prefix: {
        type: DataTypes.CHAR,
        length: 4,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        unique: true,
      },
    }, {
      tableName: 'meta_properties',
    });

    prop.prototype.toJSON = function () {
      return new Property({
        ...this.get(),
      });
    };
    return prop;
  }
}
module.exports = Property;
//
// module.exports = function (app) {
//   const config = app.get('sequelize');
//   const prop = model(app.get('sequelizeClient'), {
//     tableName: config.tables.properties || 'meta_properties',
//     hooks: {
//       beforeCount(options) {
//         options.raw = true;
//       },
//     },
//   });
//
//   return {
//     sequelize: prop,
//   };
// };

// module.exports.model = model;
