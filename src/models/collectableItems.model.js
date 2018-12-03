const { DataTypes } = require('sequelize');
const Collection = require('./collections.model');
const SearchQuery = require('./searchQueries.model');

class CollectableItem {
  constructor({
    itemId = '',
    contentType = '',
    collection = null,
    searchQuery = null,
    dateAdded = new Date(),
  } = {}) {
    this.itemId = String(itemId);
    this.contentType = String(contentType);
    if (collection instanceof Collection) {
      this.collection = collection;
    } else {
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

  static sequelize(client) {
    const collection = Collection.sequelize(client);
    const searchQuery = SearchQuery.sequelize(client);
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const collectableItem = client.define('collectableItem', {
      itemId: {
        type: DataTypes.STRING(50),
        field: 'item_id',
      },
      contentType: {
        type: DataTypes.STRING(500),
        field: 'content_type',
      },
      addedDate: {
        type: DataTypes.DATE,
        field: 'date_added',
        defaultValue: DataTypes.NOW,
      },
    }, {
      table_name: 'collectable_items',
    });

    collectableItem.belongsTo(searchQuery, {
      onDelete: 'SET NULL',
    });

    collectableItem.belongsTo(collection, {
      onDelete: 'CASCADE',
    });

    return collectableItem;
  }
}

module.exports = CollectableItem;
