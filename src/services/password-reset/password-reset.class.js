import User from '../../models/users.model'
import { logger } from '../../logger'
const jwt = require('jsonwebtoken')
const { NotImplemented, BadRequest, NotFound } = require('@feathersjs/errors')
const debug = require('debug')('impresso/services:password-reset')

/**
 * PasswordReset class for handling password reset functionality.
 * Tested with:
 * - create token, e.g with CURL:
 *
 *     curl -X POST http://localhost:3030/password-reset -H "Content-Type: application/json" -d '{"email":" <email> "}'
 *
 *   The function calls a celery task that sends an email to the user with a link to reset password.
 *   The link is generated from the callback url specified in thie callbackUrls configuration.
 *   The response of the create method is a JSON object:
 *
 *   {
 *     "response": "ok",
 *     "callbackUrl": " <callbackUrl> "
 *   }
 *
 * - then use the token in the patch method together with the password to change, e.g with CURL:
 *
 *    curl -X PATCH http://localhost:3030/password-reset -H "Content-Type: application/json" -d '{"token":" <token> ", "password":" <password> "}'
 */
class PasswordReset {
  /**
   * Creates an instance of PasswordReset.
   * @param {Object} options - The options object.
   * @param {Object} options.app - The Feathers app instance.
   */
  constructor({ app }) {
    this.sequelizeClient = app.get('sequelizeClient')
    this.config = app.get('authentication')
    this.callbackUrl = app.get('callbackUrls').passwordReset
    this.name = 'password-reset'
    this.sequelizeKlass = User.sequelize(this.sequelizeClient)
    this.app = app
  }

  /**
   * Creates a password reset request for the given email address.
   * @async
   * @param {Object} data - The data object.
   * @param {string} data.email - The email address of the user.
   * @returns {Object} The response object.
   * @throws {NotImplemented} If the celery client is not available.
   */
  async create(data) {
    const { email } = data
    debug(`[${this.name}] method: create for email: ${email}`)
    const client = this.app.get('celeryClient')
    if (!client) {
      return NotImplemented()
    }
    const user = await this.sequelizeKlass.scope('isActive', 'get').findOne({
      where: {
        email: data.email,
      },
    })
    if (!user) {
      debug('[get] uid not found <uid>:', data.email)
      return {
        response: 'ok',
        callbackUrl: this.callbackUrl,
      }
    }
    // Generate a unique token for the user's password reset request
    const token = jwt.sign({ email }, this.config.secret, { expiresIn: 60 * 5 })

    return client
      .run({
        task: 'impresso.tasks.email_password_reset',
        args: [
          // user id
          user.id,
          // query
          token,
          // callback url (app page that is repsonsible for the password reset)
          this.callbackUrl,
        ],
      })
      .catch(err => {
        if (err.result.exc_type === 'DoesNotExist') {
          throw new NotFound(err.result.exc_message)
        } else if (err.result.exc_type === 'OperationalError') {
          // probably db is not availabe
          throw new NotImplemented()
        } else if (err.result.exc_type === 'gaierror') {
          // probably a service related to the task is not available (smtp?)
          throw new NotImplemented('email service not available')
        }
        logger.error(err)
        throw new NotImplemented()
      })
      .then(() => ({
        response: 'ok',
        callbackUrl: this.callbackUrl,
      }))
    // send an email to the user with a link to reset password
  }

  /**
   * Updates the password for the user with the given token.
   * @async
   * @param {string} unusedIdParam - The unused ID parameter.
   * @param {Object} data - The data object.
   * @param {string} data.token - The token for the password reset request.
   * @param {string} data.password - The new password for the user.
   * @returns {Object} The response object.
   * @throws {BadRequest} If the token is invalid.
   */
  async patch(unusedIdParam, data) {
    // Validate the token
    const { token, password } = data
    try {
      const decoded = jwt.verify(token, this.config.secret)
      const { email } = decoded
      const user = await this.sequelizeKlass.scope('isActive', 'get').findOne({
        where: {
          email,
        },
      })
      if (!user) {
        debug('[patch] uid not found <uid>:', email)
        throw new BadRequest('Invalid token')
      }
      // Update the user's password
      const result = await this.sequelizeKlass.update(
        {
          password: User.buildPassword({ password }),
        },
        {
          // criteria
          where: { id: user.id },
        }
      )

      debug(`[patch] (user:${user.id}) success! Result:`, result)
      return {
        response: 'ok',
      }
    } catch (err) {
      logger.error(err)
      throw new BadRequest('Invalid token')
    }
  }
}

export default PasswordReset
