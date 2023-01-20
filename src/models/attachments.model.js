const { DataTypes } = require('sequelize');
// const SearchQuery = require('./searchQueries.model');

class Attachment {
  constructor ({
    id = 0,
    path = '',
    createdDate = new Date(),
    lastModifiedDate = new Date(),
  } = {}) {
    this.id = parseInt(id, 10);
    this.path = path;

    if (createdDate instanceof Date) {
      this.createdDate = createdDate;
    } else {
      this.createdDate = new Date(createdDate);
    }

    if (lastModifiedDate instanceof Date) {
      this.lastModifiedDate = lastModifiedDate;
    } else {
      this.lastModifiedDate = new Date(lastModifiedDate);
    }
  }

  static sequelize (client) {
    // const searchQuery = SearchQuery.sequelize(client);
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const attachment = client.define('attachment', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'job_id',
        unique: true,
      },
      path: {
        type: DataTypes.STRING(1),
        field: 'upload',
      },
      lastModifiedDate: {
        type: DataTypes.DATE,
        field: 'date_last_modified',
        defaultValue: DataTypes.NOW,
      },
      createdDate: {
        type: DataTypes.DATE,
        field: 'date_created',
        defaultValue: DataTypes.NOW,
      },
    }, {
      tableName: 'attachments',
    });
    return attachment;
  }
}

module.exports = Attachment;
