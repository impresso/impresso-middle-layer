import * as errors from '@feathersjs/errors'
import Debug from 'debug'
const debug = Debug('impresso/hooks:params')
import { assignIn } from 'lodash-es'
import { logger } from '../logger.js'
import { HookContext } from '@feathersjs/feathers'

const toLucene = (query: string, forceFuzzy = true) => {
  // @todo excape chars + - && || ! ( ) { } [ ] ^ " ~ * ? : \

  // replace query
  // const Q = '(:D)'; // replace quotes
  // const S = '[-_°]'; // replace spaces

  // understand \sOR\s and \sAND\s stuff.
  if (query.indexOf(' OR ') !== -1 || query.indexOf(' AND ') !== -1) {
    // this is a real lucene query.
    debug('toLucene: actual <lucene query>', query)
    return query
  }
  // split by quotes.
  let _forceFuzzy = forceFuzzy

  // console.log('word1 , "word2 , , word3 " , word 5 ",
  // word 6 , "word7 , "word8 }'.split(/("[^"]*?")/))
  // console.log('ciao "mamma "bella" e ciao'.split(/("[^"]*?")/))

  // avoid lexical error (odd number of quotes for instance)
  const q = query
    .split(/("[^"]*?")/)
    .map(d => {
      // trim spaces
      let _d = d.trim()

      // we find here
      if (_d.indexOf('"') === 0 && _d.lastIndexOf('"')) {
        // leave as it is
        return _d
      }

      // trust the user
      if (_d.indexOf('*') !== -1 && _forceFuzzy) {
        _forceFuzzy = false
      }

      // strip quotes
      _d = _d.replace(/"/g, '')

      // get rid of one letter words, multiple spaces and concatenate with simple space for the moment
      const _dr = _d.split(/\s+/).filter(k => k.length > 1)

      // if there is only one word
      if (_dr.length === 1) {
        _d = _dr.join(' ')
        return _forceFuzzy ? `${_d}*` : _d
      }

      // _dr contains COMMA? @todo
      return _dr.join(' AND ')
    })
    .join(' AND ')
  debug('toLucene: <natural query>', query, 'to <lucene query>', q)
  return q
}

const toOrderBy = (ordering: string, translateTable: Record<string, string>, lower = false) => {
  // TODO if ordering is array;
  if (ordering.indexOf('-') === 0) {
    const _ordering = translateTable[ordering.substr(1)]
    return lower ? `${_ordering} desc` : `${_ordering} DESC`
  }
  const _ordering = translateTable[ordering]
  return lower ? `${_ordering} asc` : `${_ordering} ASC`
}

const translate = <T>(key: string, dict: Record<string, T>) => dict[key]

type Query = { [key: string]: string | string[] }

export interface ValidationRule<T> {
  required?: boolean
  max_length?: number
  min_length?: number
  choices?: readonly string[]
  regex?: RegExp
  /**
   * A custom function to validate the value.
   * It should return true if the value is valid, false otherwise.
   */
  fn?: (item: string | string[] | undefined) => boolean
  message?: string
  defaultValue?: string
  transform?: (item: string | string[] | undefined) => T | undefined
  before?: (item?: string | string[]) => string | string[] | undefined
  after?: (item: T | undefined) => T | undefined
}

export type ValidationRules<T> = {
  [K in keyof T]-?: ValidationRule<T[K]>
  // `-?` is crucial: it makes the rule *required* for every key in T.
}

interface ValidationError<T> {
  code: string
  message: string
  ref?: ValidationRule<T>['choices']
  regex?: string
}

interface OrderByParams<T> {
  values: Record<string, T>
  defaultValue?: string
  required?: boolean
}

/**
 * To be used in conjunction with validate()
 * Usage:
 ```
   order_by: utils.orderBy({
     values: {
       'name': 'topic_suggest ASC',
       '-name': 'topic_suggest DESC',
     },
     defaultValue: 'name',
   }),
 ```
 * @param  {Object} [values={}, defaultValue=null]  [description]
 * @return {Object} complex validate object with before, after.
 */
const orderBy = <T = string>({
  values = {},
  defaultValue = undefined,
  required = false,
}: OrderByParams<T>): ValidationRule<T> => ({
  before: d => {
    if (typeof d === 'string') {
      return d.split(',')
    }
    return d
  },
  choices: Object.keys(values),
  defaultValue,
  required,
  transform: d => (d != null ? translate(Array.isArray(d) ? d[0] : d, values) : undefined),
  after: d => {
    if (Array.isArray(d)) {
      return d.join(',') as T
    }
    return d
  },
})

const _validateOne = <T>(key: string, item: string | string[] | undefined, rule: ValidationRule<T>): T | undefined => {
  const _errors: Record<string, ValidationError<T>> = {}

  // it is required
  if (typeof item === 'undefined' || item === null) {
    if (rule.required === true) {
      _errors[key] = {
        code: 'NotFound',
        message: `${key} required`,
      }
    } else {
      return
    }
  }

  if (rule.max_length && (item?.length ?? 0) > rule.max_length) {
    _errors[key] = {
      code: 'NotValidLength',
      message: rule.message || `${key} param is not valid`,
    }
  }
  if (rule.min_length && (item?.length ?? 0) < rule.min_length) {
    _errors[key] = {
      code: 'NotValidLength',
      message: rule.message || `${key} param is not valid`,
    }
  }
  if (rule.choices) {
    const values = Array.isArray(item) ? item : [item]
    const isValid = values.every(v => rule.choices!.includes(v as string))
    if (!isValid) {
      _errors[key] = {
        code: 'NotInArray',
        ref: rule.choices,
        message: rule.message || `${key} param is not valid`,
      }
    }
  }

  if (rule.regex && !rule.regex.test(String(item))) {
    _errors[key] = {
      code: 'NotValidRegex',
      regex: rule.regex.toString(),
      message: rule.message || `${key} param is not valid`,
    }
  }

  if (rule.fn && rule.fn(item) !== true) {
    _errors[key] = {
      code: 'NotValidCustomFunction',
      message: rule.message || `${key} param is not valid`,
    }
  }

  if (Object.keys(_errors).length) {
    debug('_validateOne: errors:', _errors)
    throw new errors.BadRequest(_errors)
  }

  // sanitize/transform params
  if (typeof rule.transform === 'function') {
    return rule.transform(item)
  }
  return item as T
}

const _validate = <T>(params: Query, rules: ValidationRules<T>) => {
  const _params: Partial<T> = {}
  const _errors: Record<string, ValidationError<T>> = {}

  for (const key in rules) {
    // 1. prepare input value
    const inputValue = typeof params[key] === 'undefined' ? rules[key].defaultValue : params[key]

    // 2. apply before hook
    const preprocessedInputValue = typeof rules[key].before === 'function' ? rules[key].before(inputValue) : inputValue

    // 3. validate
    const validatedValue = _validateOne(key, preprocessedInputValue, rules[key])

    // 4. postprocess with after hook
    const postproceessedValue =
      typeof rules[key].after === 'function' ? rules[key].after(validatedValue) : validatedValue

    _params[key] = postproceessedValue

    //   if (typeof params[key] === 'undefined') {
    //     if (rules[key] && rules[key].required && rules[key].defaultValue == null) {
    //       // required!
    //       _errors[key] = {
    //         code: 'NotFound',
    //         message: `${key} required`,
    //       }
    //     } else if (typeof rules[key].defaultValue !== 'undefined') {
    //       _params[key] = _validateOne(key, rules[key].defaultValue, rules[key])
    //     }
    //   } else {
    //     // special before hook (e.g; split comma separated values before applying a rule)
    //     const value = typeof rules[key].before === 'function' ? rules[key].before(params[key]) : params[key]

    //     // it is an Array of values
    //     if (Array.isArray(value)) {
    //       _params[key] = value.map(d => _validateOne(key, d, rules[key])).filter(v => typeof v !== 'undefined')
    //     } else if (typeof value !== 'undefined') {
    //       _params[key] = _validateOne(key, value, rules[key])
    //     }
    //     // special after hook
    //     if (typeof rules[key].after === 'function' && typeof _params[key] !== 'undefined') {
    //       _params[key] = rules[key].after(_params[key])
    //     }
    //   }
  }
  if (Object.keys(_errors).length) {
    debug('_validate: got errors', _errors)
    throw new errors.BadRequest(_errors)
  }
  return _params
}

const REGEX_EMAIL =
  // eslint-disable-next-line max-len
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
const REGEX_PASSWORD = /^(?=\S*[a-z])(?=\S*[A-Z])(?=\S*\d)(?=\S*([^\w\s]|[_]))\S{8,}$/
const REGEX_SLUG = /^[a-z0-9-]+$/
const REGEX_UID = /^[A-zÀ-Ÿ0-9_.–"',()-]+$/
const EXTENDED_REGEX_UID = /^[A-zÀ-Ÿ0-9_.–"',()/$-]+$/
const REGEX_UIDS = /^[A-zÀ-Ÿ0-9_.–,"'-]+[A-zÀ-Ÿ0-9_.,"'-]+\*?$/
const REGEX_NUMERIC = /^\d+$/

const VALIDATE_OPTIONAL_UID = {
  uid: {
    required: false,
    regex: REGEX_UID,
  },
}

const VALIDATE_UIDS = {
  uids: {
    required: true,
    regex: REGEX_UIDS,
    transform: (d: string | string[]) => (Array.isArray(d) ? d : d.split(',')),
  },
}

const VALIDATE_OPTIONAL_UIDS = {
  uids: {
    required: false,
    regex: REGEX_UIDS,
    transform: (d: string | string[]) => (Array.isArray(d) ? d : d.split(',')),
  },
}

const VALIDATE_EMAIL = {
  email: {
    required: true,
    regex: REGEX_EMAIL,
  },
}

const VALIDATE_OPTIONAL_GITHUB_ID = {
  githubId: {
    required: false,
    regex: REGEX_NUMERIC,
  },
}

const VALIDATE_OPTIONAL_EMAIL = {
  email: {
    required: false,
    regex:
      // eslint-disable-next-line max-len
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  },
}

const VALIDATE_PASSWORD = {
  password: {
    required: true,
    regex: REGEX_PASSWORD,
  },
}

const VALIDATE_OPTIONAL_PASSWORD = {
  password: {
    required: false,
    regex: REGEX_PASSWORD,
  },
}

/*
  Validate data field for POST and GET request.
  Note: it creates context.data.sanitized.
*/
const validate =
  // prettier-ignore
  <T>(validators: ValidationRules<T>, method = 'GET') => async (context: HookContext) => {
    if (!validators) {
      return
    }
    debug('validate: <validators keys>', `${context.path}.${context.method}`, Object.keys(validators))

    if (method === 'GET') {
      debug('validate: GET data', context.params.query)
      const validated = _validate(context.params.query, validators)
      if (!context.params.sanitized) {
        context.params.sanitized = validated
      } else {
        Object.assign(context.params.sanitized, validated)
      }
    } else {
      debug('validate: POST data')
      context.data.sanitized = assignIn({}, context.data.sanitized, _validate(context.data, validators))
    }
  }

const validateRouteId = () => async (context: HookContext) => {
  if (context.path === 'entities' && context.id) {
    if (!EXTENDED_REGEX_UID.test(String(context.id))) {
      debug('validateRouteId: context.id not matching EXTENDED_REGEX_UID')
      throw new errors.BadRequest('route id is not valid (use EXTENDED_REGEX_UID)')
    }
  } else if (context.id && !(REGEX_UID.test(String(context.id)) || REGEX_UIDS.test(String(context.id)))) {
    debug('validateRouteId: context.id not matching REGEX_UIDS')
    throw new errors.BadRequest('route id is not valid (use REGEX_UID)')
  }
}

/*
  Prepare common query parameters, adding them to context.params.sanitized.
  Use it as BEFORE hook

  If used in conjunciton with validate(), this hook should be placed last in order:
  ```
    validate({
      q: {
        required: false,
        min_length: 2,
        max_length: 100,
        transform: utils.toLucene
      }
    }),
    queryWithCommonParams();
  ```
*/
const queryWithCommonParams =
  // prettier-ignore
  (replaceQuery = true, method = 'GET') => async (context: HookContext) => {
    const params = {
      limit: 10,
      offset: 0,
      max_limit: 1000,
    } as { limit: number; offset: number; max_limit?: number; page?: number }

    if (!context.params) {
      context.params = {}
    }

    if (!context.params.query) {
      context.params.query = {}
    }

    const originObject = method === 'GET' ? context.params.query : context.data
    const destinationObject = method === 'GET' ? context.params : context.data

    // num of results expected, 0 to 500
    if (originObject.limit > -1) {
      const limit = parseInt(originObject.limit, 10)
      params.limit = +Math.min(Math.max(0, limit), params.max_limit || 500)
    }
    // transform page in corresponding SKIP. Page is 1-n.
    if (originObject.page) {
      logger.warn(`DEPRECATED query parameter "page" used in url: ${context.path} `)

      const page = Math.max(1, parseInt(originObject.page, 10))
      // transform in skip and offsets. E.G page=4 when limit = 10
      // results in skip=30 page=2 in skip=10, page=1 in skip=0
      params.offset = (page - 1) * params.limit
      params.page = page
    } else if (originObject.offset) {
      params.offset = Math.max(0, parseInt(originObject.offset, 10))
    } else if (originObject.skip) {
      logger.warn(`DEPRECATED auery parameter "skip" used in url: ${context.path} `)
      params.offset = Math.max(0, parseInt(originObject.skip, 10))
    }

    if (replaceQuery && method === 'GET') {
      context.params.isSafe = true
      context.params.originalQuery = {
        ...context.params.query,
      }
      context.params.query = {
        ...(context.params.sanitized || {}), // add validated params, if any
        ...params,
      }
      debug(`queryWithCommonParams (replaceQuery:${replaceQuery}), <context.params.query>:`, context.params.query)
    } else {
      destinationObject.sanitized = assignIn({}, destinationObject.sanitized, params)
      const field = method === 'GET' ? 'context.params' : 'context.data'
      debug(`queryWithCommonParams: appends params to '${field}.sanitized': ${JSON.stringify(params)}`)
    }
  }

/*
  Add sanitized parameter to context result.
*/
const verbose = () => async (context: HookContext) => {
  context.result = Array.isArray(context.result) ? { result: context.result } : {}
  context.result.params = context.params.sanitized
}

/**
 * Before hook to validate
 *
 * @param {string} paramName
 * @param {array} validators
 * @param {object} options optional, with `required` and `method`
 */
const validateEach = <T>(paramName: string, validators: ValidationRules<T>, options = {}) => {
  const opts = {
    required: false,
    method: 'GET',
    ...options,
  }

  return async (context: HookContext) => {
    if (context.type !== 'before') {
      throw new Error("The 'validateEach' hook should only be used as a 'before' hook.")
    }
    // console.log(context.params.query.filters)
    let toBeValidated

    if (opts.method === 'GET') {
      toBeValidated = context.params.query[paramName]
    } else if (opts.method === 'POST') {
      toBeValidated = context.data[paramName]
    }

    if (!Array.isArray(toBeValidated) || !toBeValidated.length) {
      if (opts.required) {
        const _error: Partial<{ [key in string]: ValidationError<T> }> = {}
        _error[paramName] = {
          code: 'NotFound',
          message: `param '${String(paramName)}' is required and shouldn't be empty.`,
        }
        // console.log(_error);
        throw new errors.BadRequest(_error)
      }
      debug(
        `validateEach: ${opts.required ? 'required' : 'optional'} ${String(paramName)} not found in '${
          opts.method
        }' or is not an Array or it is empty. Received:`,
        toBeValidated
      )
      // throw new Error(`The param ${paramName} should exist and be an array.`);
      return
    }
    debug(`validateEach: '${String(paramName)}' in '${opts.method}'. Received:`, toBeValidated)
    // _validate(context.query, validators)
    const validated = toBeValidated.map(d => {
      const _d = _validate(d, validators)
      // add mustache friendly conditionals based on type. e.g; isIssue or isNewspaper
      // _d[`_is${d.type}`] = true;
      return _d
    })

    if (opts.method === 'GET') {
      if (!context.params.sanitized) {
        context.params.sanitized = {}
      }
      context.params.sanitized[paramName] = validated
    } else {
      if (!context.data.sanitized) {
        context.data.sanitized = {}
      }
      context.data.sanitized[paramName] = validated
    }
  }
}

const displayQueryParams =
  // prettier-ignore
  (paramNames: string[] = []) => async (context: HookContext) => {
    if (context.type !== 'after') {
      throw new Error("The 'displayQueryParams' hook should only be used as a 'after' hook.")
    }
    debug(`displayQueryParams: ${paramNames}`)
    if (!context.result.info) {
      context.result.info = {}
    }
    paramNames.forEach(p => {
      if (context.params && context.params.sanitized && context.params.sanitized[p]) {
        context.result.info[p] = context.params.sanitized[p]
      }
    })
  }

const protect =
  // prettier-ignore
  (...fields: string[]) => async (context: HookContext) => {
    fields.forEach(p => {
      if (Array.isArray(context.result.data)) {
        context.result.data = context.result.data.map((d: Record<string, unknown>) => {
          delete d[p]
          return d
        })
      } else {
        delete context.result[p]
      }
    })
  }

const sanitize = _validate
const utils = {
  orderBy,
  toOrderBy,
  toLucene,
  translate,
}

export {
  displayQueryParams,
  protect,
  verbose,
  validate,
  validateEach,
  queryWithCommonParams,
  sanitize,
  validateRouteId,
  VALIDATE_OPTIONAL_UID,
  VALIDATE_OPTIONAL_GITHUB_ID,
  VALIDATE_OPTIONAL_EMAIL,
  VALIDATE_OPTIONAL_PASSWORD,
  VALIDATE_EMAIL,
  VALIDATE_PASSWORD,
  VALIDATE_OPTIONAL_UIDS,
  VALIDATE_UIDS,

  // common regex
  REGEX_EMAIL,
  REGEX_NUMERIC,
  REGEX_PASSWORD,
  REGEX_SLUG,
  REGEX_UID,
  REGEX_UIDS,
  utils,
}
