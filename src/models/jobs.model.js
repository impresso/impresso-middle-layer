/* eslint-disable no-unused-vars */
const { DataTypes } = require('sequelize');
const Attachment = require('./attachments.model');
const User = require('./users.model');

const TYPE_BULK_COLLECTION_FROM_QUERY = 'BCQ';
const TYPE_DELETE_COLLECTION = 'DCO';
const TYPE_SYNC_COLLECTION_TO_SOLR = 'IDX';

const STATUS_READY = 'REA';
const STATUS_RUN = 'RUN';
const STATUS_DONE = 'DON';
const STATUS_ERR = 'ERR';
const STATUS_ARCHIVED = 'ARC';


class Job {
  constructor({
    id = -1,
    labels = ['job'],
    creationDate = new Date(),
    lastModifiedDate = new Date(),
    creator = null,
    type = '',
    status = STATUS_READY,
    extra = '',
    attachment = null,
  } = {}) {
    this.id = parseInt(id, 10);
    this.status = status;
    this.type = type;
    if (typeof extra === 'object') {
      this.extra = extra;
    } else {
      try {
        this.extra = JSON.parse(extra);
      } catch (e) {
        if (e.name !== 'SyntaxError') {
          console.error(e);
        }
      }
    }
    if (creationDate instanceof Date) {
      this.creationDate = creationDate;
    } else {
      this.creationDate = new Date(creationDate);
    }

    if (lastModifiedDate instanceof Date) {
      this.lastModifiedDate = lastModifiedDate;
    } else {
      this.lastModifiedDate = new Date(lastModifiedDate);
    }

    if (attachment) {
      this.attachment = attachment;
    }
    this.creator = creator;
  }

  static sequelize(client) {
    const creator = User.sequelize(client);
    const attachment = Attachment.sequelize(client);
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const job = client.define('job', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true,
      },
      type: {
        type: DataTypes.CHAR(3),
      },
      status: {
        type: DataTypes.CHAR(3),
        defaultValue: STATUS_READY,
      },
      creationDate: {
        type: DataTypes.DATE,
        field: 'date_created',
        defaultValue: DataTypes.NOW,
      },
      lastModifiedDate: {
        type: DataTypes.DATE,
        field: 'date_last_modified',
        defaultValue: DataTypes.NOW,
      },
      extra: {
        type: DataTypes.JSON,
      },
      creatorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'creator_id',
      },
    }, {
      defaultScope: {
        include: [
          {
            model: creator,
            as: 'creator',
          },
          {
            model: attachment,
            as: 'attachment',
          },
        ],
      },
    });

    job.belongsTo(creator, {
      as: 'creator',
      foreignKey: {
        fieldName: 'creator_id',
      },
      onDelete: 'CASCADE',
    });

    job.hasOne(attachment, {
      as: 'attachment',
      foreignKey: {
        fieldName: 'job_id',
      },
      constraints: false,
      onDelete: 'CASCADE',
    });

    job.prototype.toJSON = function (obfuscate = true) {
      return new Job({
        id: this.id,
        name: this.name,
        type: this.type,
        description: this.description,
        status: this.status,
        creationDate: this.creationDate,
        lastModifiedDate: this.lastModifiedDate,
        extra: this.extra,
        attachment: this.attachment ? this.attachment.toJSON() : null,
        creator: this.creator.toJSON({
          obfuscate,
        }),
      });
    };

    return job;
  }
}

module.exports = Job;
