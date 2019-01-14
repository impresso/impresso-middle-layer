const { DataTypes } = require('sequelize');
const Collection = require('./collections.model');
const SearchQuery = require('./searchQueries.model');

const CONTENT_TYPES = {

  A: 'article',
  E: 'entity',
  P: 'page',
  I: 'issue',

};

class CollectableItem {
  constructor({
    id = -1,
    uid = null,
    itemId = '',
    contentType = '',
    collection = null,
    searchQuery = null,
    dateAdded = new Date(),
  } = {}) {
    this.id = parseInt(id, 10);
    this.uid = String(uid || this.id);
    this.itemId = String(itemId);
    this.contentType = String(contentType);

    if (collection instanceof Collection) {
      this.collection = collection;
    } else if (collection) {
      // note: this avoids sequelize error
      // ```
      // cannot destructure property `uid` of 'undefined' or 'null'.
      // ```
      this.collection = new Collection(collection);
    }

    if (searchQuery instanceof SearchQuery) {
      this.searchQuery = searchQuery;
    } else if (searchQuery) {
      this.searchQuery = new SearchQuery(searchQuery);
    }
    if (dateAdded instanceof Date) {
      this.dateAdded = dateAdded;
    } else {
      this.dateAdded = new Date(dateAdded);
    }
  }

  getContentType() {
    return CONTENT_TYPES[this.contentType];
  }

  static sequelize(client) {
    const collection = Collection.sequelize(client);
    const searchQuery = SearchQuery.sequelize(client);
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const collectableItem = client.define('collectableItem', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true,
      },
      itemId: {
        type: DataTypes.STRING(50),
        field: 'item_id',
      },
      contentType: {
        type: DataTypes.STRING(1),
        field: 'content_type',
      },
      addedDate: {
        type: DataTypes.DATE,
        field: 'date_added',
        defaultValue: DataTypes.NOW,
      },
      collectionId: {
        type: DataTypes.STRING(50),
        field: 'collection_id',
      },
    }, {
      tableName: 'collectable_items',
      defaultScope: {
        include: [
          {
            model: collection,
            as: 'collection',
          },
        ],
      },
      scopes: {
        simple: {
          include: [],
        },
      },
    });

    collectableItem.prototype.toJSON = function () {
      const item = new CollectableItem({
        ...this.get(),
      });

      if (this.collection) {
        // obfuscate user
        item.collection = this.collection.toJSON(true);
      }
      return item;
    };
    collectableItem.belongsTo(searchQuery, {
      onDelete: 'SET NULL',
      foreignKey: {
        fieldName: 'search_query_id',
      },
    });

    collectableItem.belongsTo(collection, {
      onDelete: 'CASCADE',
      foreignKey: {
        fieldName: 'collection_id',
      },
    });

    return collectableItem;
  }
}

module.exports = CollectableItem;
