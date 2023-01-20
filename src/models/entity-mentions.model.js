const { DataTypes } = require('sequelize');

const TYPES = {
  50: 'person',
  54: 'location',
};

class MentionAncillary {
  constructor ({
    firstname = '',
    surname = '',
    title = '',
    qualifier = '',
    fn = '',
    demonym = '',
  } = {}) {
    this.firstname = String(firstname);
    this.surname = String(surname);
    this.title = String(title);
    this.qualifier = String(qualifier);
    this.fn = String(fn);
    this.demonym = String(demonym);
  }

  static sequelize (client, {
    tableName = 'mentions_ancillary',
  } = {}) {
    const mentionAncillary = client.define('mentionAncillary', {
      // person specific
      firstname: {
        type: DataTypes.STRING(500),
      },
      surname: {
        type: DataTypes.STRING(500),
      },
      title: {
        type: DataTypes.STRING(500),
      },
      fn: {
        type: DataTypes.STRING(500),
        field: 'function',
      },
      qualifier: {
        type: DataTypes.STRING(500),
      },
      demonym: {
        type: DataTypes.STRING(500),
      },
      mention_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    }, {
      tableName,
    });

    mentionAncillary.prototype.toJSON = function () {
      return new MentionAncillary({
        ...this.get(),
      });
    };
    return mentionAncillary;
  }
}

class EntityMention {
  constructor ({
    offsetStart = 0,
    offsetLength = 0,
    confidence = null,
    name = '',
    surface = '',
    type = '',
    entityId = '',
    articleUid = '',
    mentionAncillary = null,
  } = {}) {
    this.entityId = String(entityId);
    this.articleUid = String(articleUid);
    this.type = TYPES[String(type)] || String(type);

    this.name = String(name);
    this.t = String(surface);
    this.l = parseInt(offsetStart, 10);
    this.r = this.l + parseInt(offsetLength, 10);
    this.confidence = confidence;
    if (mentionAncillary) {
      this.ancillary = new MentionAncillary({
        ...mentionAncillary.get(),
      });
    }
  }

  static sequelize (client, {
    tableName = 'mentions',
  } = {}) {
    const mentionAncillary = MentionAncillary.sequelize(client);

    const entityMention = client.define('entityMention', {
      offsetStart: {
        type: DataTypes.INTEGER,
        field: 'start_offset',
      },
      offsetLength: {
        type: DataTypes.INTEGER,
        field: 'length',
      },
      surface: {
        type: DataTypes.STRING(500),
      },
      name: {
        type: DataTypes.STRING(500),
      },
      confidence: {
        type: DataTypes.STRING(10),
      },
      type: {
        type: DataTypes.STRING(500),
        field: 'type_id',
      },
      entityId: {
        type: DataTypes.STRING(255),
        field: 'entity_id',
      },
      articleUid: {
        type: DataTypes.STRING(50),
        field: 'ci_id',
      },
    }, {
      tableName,
      defaultScope: {
        include: [
          {
            model: mentionAncillary,
            as: 'mentionAncillary',
          },
        ],
      },
    });

    entityMention.hasOne(mentionAncillary, {
      foreignKey: {
        fieldName: 'mention_id',
      },
    });

    entityMention.prototype.toJSON = function () {
      return new EntityMention({
        ...this.get(),
      });
    };

    return entityMention;
  }
}

// class EntityMention {
//   constructor({
//     id = '',
//     entityId = 0,
//     articleUid = '',
//     surface = '',
//     offsetStart = 0,
//     offsetLength = 0,
//     confidence = '',
//     type = '',
//     name = '',
//     firstname = '',
//     surname = '',
//     title = '',
//     fn = '',
//     qualifier = '',
//     demonym = '',
//   } = {}) {
//     this.id = parseInt(id, 10);
//     this.entityId = parseInt(entityId, 10);
//     this.articleUid = String(articleUid);
//     this.type = String(type);
//     this.name = String(name);
//     this.t = String(surface);
//     this.l = parseInt(offsetStart, 10);
//     this.r = this.l + parseInt(offsetLength, 10);
//     this.confidence = confidence;
//
//     if (type === AS_PERSON) {
//       this.type = 'person';
//       this.firstname = String(firstname);
//       this.surname = String(surname);
//       this.fn = String(fn);
//       this.title = String(title);
//       this.qualifier = String(qualifier);
//       this.demonym = String(demonym);
//     }
//   }
//
//   static sequelize(client, {
//     tableName = 'mentions_v',
//   } = {}) {
//     const entityMention = client.define('entityMention', {
//       id: {
//         type: DataTypes.INTEGER,
//         primaryKey: true,
//         autoIncrement: true,
//         unique: true,
//       },
//       offsetStart: {
//         type: DataTypes.INTEGER,
//         field: 'start_offset',
//       },
//       offsetLength: {
//         type: DataTypes.INTEGER,
//         field: 'length',
//       },
//       confidence: {
//         type: DataTypes.STRING(10),
//       },
//       type: {
//         type: DataTypes.STRING(500),
//         field: 'label',
//       },
//       name: {
//         type: DataTypes.STRING(500),
//       },
//       surface: {
//         type: DataTypes.STRING(500),
//       },
//       // person specific
//       firstname: {
//         type: DataTypes.STRING(500),
//       },
//       surname: {
//         type: DataTypes.STRING(500),
//       },
//       title: {
//         type: DataTypes.STRING(500),
//       },
//       fn: {
//         type: DataTypes.STRING(500),
//         field: 'function',
//       },
//       qualifier: {
//         type: DataTypes.STRING(500),
//       },
//       demonym: {
//         type: DataTypes.STRING(500),
//       },
//       entityId: {
//         type: DataTypes.INTEGER,
//         field: 'entity_id',
//       },
//       articleUid: {
//         type: DataTypes.STRING(50),
//         field: 'ci_id',
//       },
//     }, {
//       tableName,
//     });
//
//     entityMention.prototype.toJSON = function () {
//       return new EntityMention({
//         ...this.get(),
//       });
//     };
//
//     return entityMention;
//   }
// }

module.exports = EntityMention;
