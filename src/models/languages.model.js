const { DataTypes } = require('sequelize');

class Language {
  constructor ({
    uid = '',
    code = '',
    uri = '',
  } = {}) {
    this.uid = String(uid);
    this.code = String(code);
    this.uri = String(uri);
  }

  static sequelize (client) {
    return client.define('language', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
      },
      code: {
        type: DataTypes.CHAR,
        length: 2,
        allowNull: false,
      },
      uri: {
        type: DataTypes.STRING,
        field: 'lexvo_uri',
      },
    });
  }
}

module.exports = Language;
// module.exports = function (app) {
//   const config = app.get('sequelize');
//   const language = model(app.get('sequelizeClient'), {
//     tableName: config.tables.languages || 'languages',
//     hooks: {
//       beforeCount(options) {
//         options.raw = true;
//       },
//     },
//   });
//
//   return {
//     sequelize: language,
//   };
// };
//
// module.exports.model = model;
