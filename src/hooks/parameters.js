const { BadRequest } = require('@feathersjs/errors')

/**
 * Please call this hook after id has been validated with the `validateId` hook
 */
const splitId =
  (separator = ',', againstList = []) =>
    async (context) => {
      if (Array.isArray(context.id)) {
        return context
      }
      context.id = context.id.split(separator)
      if (
        againstList.length > 0 &&
      context.id.some((d) => !againstList.includes(d))
      ) {
        throw new BadRequest(
          `id param should be one of these values: ${JSON.stringify(
            againstList
          )}, found: "${context.id}"`
        )
      }
      return context
    }

const limitNumberOfIds =
  (limit = 0) =>
    (context) => {
      if (!Array.isArray(context.id)) {
        return context
      }
      if (context.id.length > limit) {
        throw new BadRequest(
          `id param must be a comma separated list of max ${limit} items, found: "${context.id}" (${context.id.length} items)`
        )
      }
    }

module.exports = { splitId, limitNumberOfIds }
