import type { Sequelize } from 'sequelize'
import initDebug from 'debug'
import type { ImpressoApplication } from '../../types'
import User from '../../models/users.model'
import { BadRequest, NotFound } from '@feathersjs/errors'
import UserChangePlanRequest, { StatusPending } from '../../models/user-change-plan-request'

const debug = initDebug('impresso:services/user-change-plan-request')

export interface ServiceOptions {
  app: ImpressoApplication
  name: string
}

/**
 * Service class responsible for handling user plan change requests.
 *
 * Provides methods for creating and retrieving `UserChangePlanRequest` records
 * tied to individual users. Delegates side-effect operations like notifications
 * to external Celery tasks.
 *
 * @class
 */
export class Service {
  /**
   * The Feathers application instance.
   *
   * @type {ImpressoApplication}
   */
  app: ImpressoApplication
  /**
   * The service name.
   *
   * @type {string}
   */
  name: string
  /**
   * Sequelize client used for database operations.
   *
   * @type {Sequelize | undefined}
   */
  sequelizeClient?: Sequelize
  /**
   * Creates a new instance of the Service.
   *
   * @constructor
   * @param {ServiceOptions} options - Options for initializing the service.
   * @param {ImpressoApplication} options.app - The Feathers application instance.
   * @param {string} options.name - The name of the service.
   */
  constructor({ app, name }: ServiceOptions) {
    this.app = app
    this.name = name
    this.sequelizeClient = app.get('sequelizeClient')
    debug('Service initialized.')
  }

  /**
   * Retrieves the existing `UserChangePlanRequest` for the authenticated user.
   *
   * This method queries the database for a plan change request associated with the user.
   * If no request is found, it throws a `NotFound` error. The returned result includes
   * the associated plan information.
   *
   * @async
   * @function
   * @param {{ user: { id: number } }} params - Request context containing the authenticated user's ID.
   *
   * @returns {Promise<Object>} The existing user plan change request, including the related plan data.
   *
   * @throws {Error} If `sequelizeClient` is not available.
   * @throws {NotFound} If no plan change request is found for the user.
   *
   * @example
   * const result = await service.find({ user: { id: 123 } });
   * console.log(result); // { id: ..., plan: ..., status: ..., ... }
   */
  async find(params: { user: { id: number } }): Promise<object> {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    debug('[find] plan request for user.pk', params.user.id, params.user)
    const userChangePlanRequestModel = UserChangePlanRequest.initModel(this.sequelizeClient)
    const userChangePlanRequest = await userChangePlanRequestModel.findOne({
      where: {
        userId: params.user.id,
      },
      include: ['plan'],
    })
    if (!userChangePlanRequest) {
      throw new NotFound()
    }
    return userChangePlanRequest.get()
  }

  /**
   * FeathersJS `create` method override for initiating a user plan change request.
   * This method is idempotent per user — meaning only one plan change request can exist at a time.
   * If the user is already in the requested plan or has a pending request, it throws a BadRequest.
   * Otherwise, it enqueues a Celery task (email_plan_change) to handle both the email exchange and plan change request.
   *
   * Important: The actual side effects (like plan upgrades or email notifications) are handled asynchronously by a Celery worker.
   * This method only enqueues the task.
   * @async
   * @function
   * @param {{ plan: string }} data - The plan the user wants to switch to.
   * @param {{ user: { id: number, groups: string[] } }} params - Request context containing the authenticated user's ID and groups.
   *
   * @returns {Promise<{ response: 'ok', created: boolean }>} A result object indicating success and whether a new request was created.
   *
   * @throws {Error} If `celeryClient` or `sequelizeClient` is not available.
   * @throws {BadRequest} If:
   * - The user already has access to the requested plan.
   * - The user already has a pending plan change request.
   *
   * @example
   * await service.create(
   *   { plan: 'plan-basic' },
   *   { user: { id: 123, groups: ['basic'] } }
   * )
   */
  async create(
    data: { plan: string },
    params: { user: { id: number; groups: string[] } }
  ): Promise<{ response: 'ok'; created: boolean }> {
    const client = this.app.get('celeryClient')
    if (!client) {
      throw new Error('Celery client not available')
    }
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    debug('[create] plan request for user.pk', params.user.id, 'plan:', data.plan, params.user)
    // check if the plan selected is already included in params.user.groups
    if (params.user.groups?.includes(data.plan)) {
      throw new BadRequest('User is already granted access to the requested plan.', { plan: 'Already granted' })
    }
    // check if the user is already in the process of changing the plan
    const userChangePlanRequestModel = UserChangePlanRequest.initModel(this.sequelizeClient)
    const userChangePlanRequest = await userChangePlanRequestModel.findOne({
      where: {
        userId: params.user.id,
      },
    })
    if (userChangePlanRequest) {
      if (userChangePlanRequest.status === StatusPending) {
        // return the existing request as data in BadRequest error
        throw new BadRequest('User is already in the process of changing the plan', userChangePlanRequest?.get())
      }
      // Only the status is updated here; the plan itself will be updated by the Celery task via Django signals.
      await userChangePlanRequest.update({ status: StatusPending })
    }

    return client
      .run({
        task: 'impresso.tasks.email_plan_change',
        // email_plan_change(self, user_id: int, plan: str = None)
        args: [params.user.id, data.plan],
      })
      .catch((error: Error) => {
        debug('[create] error:', error)
        throw error
      })
      .then(() => ({
        response: 'ok',
        created: userChangePlanRequest === null,
        // If userChangePlanRequest is null, it means a new request was created
      }))
  }
}
