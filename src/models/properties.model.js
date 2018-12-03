const { DataTypes } = require('sequelize');

class Property {
  static sequelize(client) {
    return client.define('prop', {
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
