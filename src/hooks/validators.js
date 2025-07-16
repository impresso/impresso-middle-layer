/* eslint-disable max-len */
import { logger } from '../logger'
const debug = require('debug')('impresso/hooks/validators')
const { get, set } = require('lodash')
const { BadRequest } = require('@feathersjs/errors')
const Validator = require('jsonschema').Validator
const { validated, formatValidationErrors } = require('../util/jsonschema')

const RegExpEmail =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
const RegExpPassword = /^(?=\S*[a-z])(?=\S*[A-Z])(?=\S*\d)(?=\S*([^\w\s]|[_]))\S{8,}$/
const RegExpSlug = /^[A-Za-z0-9-,]+$/
const RegExpExtendedString = /^[A-zÀ-Ÿ0-9_.–"',()-]+$/
const RegExpIntegersOnly = /^\d+$/

/**
 * Validate context aspect with schema.
 *
 * @param {string} objectPath path in context
 * @param {url} schemaUri as saved in schema
 * @param {Object} params optional settings
 * @return {Object} context
 */

const validateWithSchemaUri =
  // prettier-ignore
  (objectPath = 'data', schemaUri, { asJSON = false, isOptional = false, label = null, defaultValue = null } = {}) => context => {
    debug('validateWithSchemaUri schemaUri:', schemaUri, 'objectPath:', objectPath, get(context, objectPath), asJSON)
    let candidate = get(context, objectPath, null)
    const labelPath = label || objectPath
    if (candidate === null) {
      if (isOptional) {
        // if defaultvalue !== null
        if (defaultValue) {
          set(context, objectPath, defaultValue)
        }
        return context
      }
      throw new BadRequest(`${labelPath} is required.`)
    }
    if (asJSON && typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate)
      } catch (e) {
        logger.error(e)
        throw new BadRequest('Bad JSON received, check your input data.', {
          [labelPath]: 'should be a valid JSON parameter',
        })
      }
    }
    try {
      validated(candidate, schemaUri)
      if (asJSON) {
        set(context, objectPath, candidate)
      }
      return context
    } catch (e) {
      throw new BadRequest(`Invalid Parameters on ${objectPath}: ${e.message}`, {
        errors: formatValidationErrors(e.errors),
      })
    }
  }

const validatePagination =
  // prettier-ignore
  (objectPath = 'params.query', defaultPagination = {}) => async context => {
    const pagination = {
      limit: 10,
      offset: 0,
      max_limit: 100,
      page: 1,
      ...defaultPagination,
    }
    const query = get(context, objectPath)
    debug('validatePagination received:', objectPath, query)
    // validate against regexp
    const safeQuery = Object.keys(pagination).reduce((acc, prop) => {
      if (typeof query[prop] === 'undefined') {
        acc[prop] = +pagination[prop]
      } else if (isNaN(query[prop]) || query[prop] < 0) {
        throw new BadRequest(`"${prop}" value is not a valid number`)
      } else {
        acc[prop] = parseInt(query[prop], 10)
      }
      return acc
    }, {})
    if (safeQuery.limit > pagination.max_limit) {
      throw new BadRequest(`"limit" value exceeds max value of ${pagination.max_limit}`)
    }
    debug('validatePagination transformed to:', objectPath, safeQuery)
    // recalculate offset using page and limit
    if (query.page) {
      safeQuery.offset = (query.page - 1) * safeQuery.limit
    }

    set(context, objectPath, {
      ...query,
      ...safeQuery,
    })
    return context
  }

const validateAgainstOptions =
  // prettier-ignore
  (objectPath = 'params.query.enum', options = [], defaultValue = null) => async context => {
    const value = get(context, objectPath)
    debug('validateAgainstOptions received:', objectPath, value, typeof value)
    if (typeof value !== 'string') {
      set(context, objectPath, defaultValue)
    } else if (!options.includes(value)) {
      debug('validateAgainstOptions: value not in options', value, options)
      throw new BadRequest(`"${value}" is not a valid value`)
    }
    return context
  }

/**
 * This Hook validate query params agains a custom schema
 */
const validateQueryUsingJSONSchema =
  // prettier-ignore
  (schema = {}) => async context => {
    debug(context.params)
    const validator = new Validator()
    const result = validator.validate(context.params.query, schema)
    if (result.valid) {
      throw new BadRequest('GOOD')
    }
    throw new BadRequest('Query does not validate the schema', {
      schema,
      result,
    })
  }

/**
 * The `validateId` hook validate ID against a regexp
 */
const validateId =
  // prettier-ignore
  (regexp = RegExpIntegersOnly) => async context => {
    if (!regexp.test(context.id)) {
      debug('validateRouteId: context.id not matching REGEX_UIDS')
      throw new BadRequest(`id parameter is not valid, should fit regexp: ${regexp}`)
    }
  }

module.exports = {
  RegExpEmail,
  RegExpPassword,
  RegExpSlug,
  RegExpExtendedString,
  RegExpIntegersOnly,
  validateAgainstOptions,
  validateQueryUsingJSONSchema,
  validateId,
  validatePagination,
  validateWithSchemaUri,
}
