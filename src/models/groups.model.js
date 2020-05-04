const { DataTypes } = require('sequelize');

class Group {
  constructor({
    id = '',
    name = '',
  } = {}) {
    this.id = String(id);
    this.name = String(name);
  }

  isValid() {
    return !!this.uid.length;
  }

  static sequelize(client) {
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const group = client.define('group', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    }, {
      tableName: 'auth_group',
    });

    group.prototype.toJSON = function () {
      const { id, name } = this;
      return new Group({ id, name });
    };
    return group;
  }
}

module.exports = Group;
