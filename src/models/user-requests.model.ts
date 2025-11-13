import { DataTypes, ModelDefined, Sequelize } from 'sequelize'
import SubscriptionDataset, { type SubscriptionDatasetAttributes } from './subscription-datasets.model'
import User from './users.model'

export const StatusPending = 'pending'
export const StatusApproved = 'approved'
export const StatusRejected = 'rejected'
export const AvailableStatuses = [StatusPending, StatusApproved, StatusRejected]

interface ChangelogEntryAttributes {
  status: (typeof AvailableStatuses)[number]
  subscription: string
  date: string
  reviewer: string
}

/**
 * ChangelogEntry class correspond to each changelog entry in the user request.
 * ```python
 *   changelog_entry = {
 *     "status": self.status,
 *     "subscription": self.subscription.name if self.subscription else None,
 *     "date": self.date_last_modified.isoformat(),
 *     "reviewer": self.reviewer.username if self.reviewer else None,
 *   }
 * ```
 * @class ChangelogEntry
 * @param {ChangelogEntryAttributes} attributes
 * @property {string} status
 * @property {string} subscription
 * @property {string} date
 * @property {string} reviewer
 *
 */
export class ChangelogEntry {
  status: (typeof AvailableStatuses)[number]
  subscription: string
  date: string
  reviewer: string

  constructor({ status, subscription, date, reviewer }: ChangelogEntryAttributes) {
    this.status = status
    this.subscription = subscription
    this.date = date
    this.reviewer = reviewer
  }
}

/**
 * UserRequest class correspond to each user request.
 * ```python
 * class UserRequest(models.Model):
 *    STATUS_PENDING = "pending"
 *    STATUS_APPROVED = "approved"
 *    STATUS_REJECTED = "rejected"
 *
 *    subscriber = models.ForeignKey(
 *        User, on_delete=models.CASCADE, related_name="request"
 *    )
 *    reviewer = models.ForeignKey(
 *        User, on_delete=models.SET_NULL, related_name="review", null=True, blank=True
 *    )
 *    subscription = models.ForeignKey(
 *        DatasetBitmapPosition, on_delete=models.SET_NULL, null=True
 *    )
 *    date_created = models.DateTimeField(auto_now_add=True)
 *    date_last_modified = models.DateTimeField(auto_now=True)
 *    status = models.CharField(
 *        max_length=10,
 *        default=STATUS_PENDING,
 *        choices=(
 *            (STATUS_PENDING, "Pending"),
 *            (STATUS_APPROVED, "Approved"),
 *            (STATUS_REJECTED, "Rejected"),
 *        ),
 *    )
 *    changelog = models.JSONField(null=True, blank=True, default=list)
 * ```
 * @class UserRequest
 * @param {UserRequestAttributes} attributes
 * @property {number} id
 * @property {number} reviewerId
 * @property {number} subscriberId
 * @property {SubscriptionDatasetAttributes} subscription
 * @property {Date} dateCreated
 * @property {Date} dateLastModified
 * @property {typeof AvailableStatuses[number]} status
 * @property {ChangelogEntry[]} changelog
 */
export interface UserRequestAttributes {
  id: number
  reviewerId: number | null
  subscriberId: number
  subscription: SubscriptionDatasetAttributes | null
  dateCreated: Date
  dateLastModified: Date
  status: (typeof AvailableStatuses)[number]
  changelog: ChangelogEntry[]
}

// Define the creation attributes for the Group model
interface UserRequestCreationAttributes extends Omit<UserRequestAttributes, 'id'> {}

export default class UserRequest {
  id: number
  reviewerId: number | null
  subscriberId: number
  subscription: SubscriptionDatasetAttributes | null
  dateCreated: Date
  dateLastModified: Date
  status: (typeof AvailableStatuses)[number]
  changelog: ChangelogEntry[]

  constructor({
    id = 0,
    reviewerId = 0,
    subscriberId = 0,
    subscription = null,
    dateCreated = new Date(),
    dateLastModified = new Date(),
    status = StatusPending,
    changelog = [],
  }: UserRequestAttributes) {
    this.id = id
    this.reviewerId = reviewerId
    this.subscriberId = subscriberId
    this.subscription = subscription
    this.dateCreated = dateCreated
    this.dateLastModified = dateLastModified
    this.status = status
    this.changelog = changelog
  }

  static sequelize(client: Sequelize) {
    const userRequest: ModelDefined<UserRequestAttributes, UserRequestCreationAttributes> = client.define(
      'userRequest',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        reviewerId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'reviewer_id',
        },
        subscriberId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'subscriber_id',
        },
        subscriptionId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'subscription_id',
        },
        dateCreated: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'date_created',
        },
        dateLastModified: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'date_last_modified',
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        changelog: {
          type: DataTypes.JSON,
          allowNull: false,
        },
      },
      {
        tableName: 'impresso_userspecialmembershiprequest',
      }
    )
    userRequest.belongsTo(SubscriptionDataset.sequelize(client), {
      foreignKey: 'subscriptionId',
      as: 'subscription',
    })
    userRequest.belongsTo(User.sequelize(client), {
      foreignKey: 'reviewerId',
      as: 'reviewer',
    })
    userRequest.belongsTo(User.sequelize(client), {
      foreignKey: 'subscriberId',
      as: 'subscriber',
    })

    userRequest.prototype.toJSON = function () {
      const userRequest = this.dataValues
      if (userRequest.subscription) {
        userRequest.subscription = userRequest.subscription.toJSON()
      }
      if (userRequest.reviewer) {
        userRequest.reviewer = userRequest.reviewer.toJSON()
      }
      if (userRequest.subscriber) {
        userRequest.subscriber = userRequest.subscriber.toJSON()
      }
      return new UserRequest({
        id: userRequest.id,
        reviewerId: userRequest.reviewerId,
        subscriberId: userRequest.subscriberId,
        subscription: userRequest.subscription,
        dateCreated: userRequest.dateCreated,
        dateLastModified: userRequest.dateLastModified,
        status: userRequest.status,
        changelog: userRequest.changelog,
      })
    }

    return userRequest
  }
}
