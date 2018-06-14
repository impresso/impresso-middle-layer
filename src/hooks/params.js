const errors = require('@feathersjs/errors');
const crypto = require('crypto');
const configuration  = require('@feathersjs/configuration')()();
const debug = require('debug')('impresso/hooks:params');

const toLucene = (query, force_fuzzy=true) => {
  // @todo excape chars + - && || ! ( ) { } [ ] ^ " ~ * ? : \

  // replace query
  var Q = '(:D)', // replace quotes
      S = '[-_°]', // replace spaces
      q;

  // understand \sOR\s and \sAND\s stuff.
  if(query.indexOf(' OR ') !== -1 || query.indexOf(' AND ') !== -1){
    // this is a real lucene query.
    debug('toLucene: actual <lucene query>', query)
    return query
  }

  let _escape = () => {

  }



  // split by quotes.


  // console.log('word1 , "word2 , , word3 " , word 5 ", word 6 , "word7 , "word8 }'.split(/("[^"]*?")/))
  // console.log('ciao "mamma "bella" e ciao'.split(/("[^"]*?")/))

  // avoid lexical error (odd number of quotes for instance)
  q = query.split(/("[^"]*?")/).map(d => {
    // trim spaces
    let _d = d.trim();

    // we find here
    if(_d.indexOf('"') === 0 && _d.lastIndexOf('"')){
      // leave as it is
      return _d
    }

    // trust the user
    if(_d.indexOf('*') !== -1 && force_fuzzy)
      force_fuzzy = false;

    // strip quotes
    _d = _d.replace(/"/g, '')

    // get rid of one letter words, multiple spaces and concatenate with simple space for the moment
    let _dr = _d.split(/\s+/).filter(k => k.length > 1)

    // if there is only one word
    if(_dr.length == 1) {
      _d = _dr.join(' ');
      return force_fuzzy? _d+'*': _d;
    }

    // _dr contains COMMA? @todo
    return _dr.join(' AND ');
  }).join(' AND ')
  debug('toLucene: <natural query>', query, 'to <lucene query>', q)
  return q;
}


const toOrderBy = (ordering, translateTable) => {
  if(ordering.indexOf('-') === 0) {
    const _ordering = translateTable[ordering.substr(1)];
    return `${_ordering} DESC`
  }
  const _ordering = translateTable[ordering];
  return `${_ordering} ASC`
}

const _validateOne = (key, item, rule) => {
  let _errors = {};
  // it is required
  if(rule.required === true && typeof item == 'undefined'){
    _errors[key] =  {
      code: 'NotFound',
      message: key + ' required'
    };
  } else if(typeof item == 'undefined'){
    return
  }

  if(rule.max_length && item.length > rule.max_length) {
    _errors[key] =  {
      code: 'NotValidLength',
      message: rule.message || key + ' param is not valid'
    };
  }
  if(rule.min_length && item.length < rule.min_length) {
    _errors[key] =  {
      code: 'NotValidLength',
      message: rule.message || key + ' param is not valid'
    };
  }
  if(rule.choices && rule.choices.indexOf(item) === -1) {
    _errors[key] =  {
      code: 'NotInArray',
      ref: rule.choices,
      message: rule.message || key + ' param is not valid'
    };
  }

  if(rule.regex && !rule.regex.test(item)) {
    _errors[key] =  {
      code: 'NotValidRegex',
      regex: rule.regex.toString(),
      message: rule.message || key + ' param is not valid'
    };
  }

  if(rule.fn && rule.fn(item) !== true) {
    _errors[key] =  {
      code: 'NotValidCustomFunction',
      message: rule.message || key + ' param is not valid'
    };
  }

  // sanitize/transform params
  if(typeof rule.transform == 'function') {
    item = rule.transform(item);
  }

  if(Object.keys(_errors).length) {
    debug('_validateOne: errors:', _errors)
    throw new errors.BadRequest(_errors);
  }

  return item;
}

const _validate = (params, rules) => {
  let _params = {},
      _errors = {};

  for(let key in rules) {
    // special before hook (e.g; split comma separated values before applying a rule)
    if(typeof rules[key].before == 'function') {
      params[key] = rules[key].before(params[key])
    }
    // it is an Array of values
    if(Array.isArray(params[key])) {
      _params[key] = params[key].map(d => _validateOne(key, d, rules[key]))
    } else {
      _params[key] = _validateOne(key, params[key], rules[key]);
    }

    // special after hook
    if(typeof rules[key].after == 'function') {
      _params[key] = rules[key].after(_params[key])
    }
  }
  if(Object.keys(_errors).length){
    console.log(_errors)
    throw new errors.BadRequest(_errors);
  }
  return _params
}

const REGEX_EMAIL    = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
const REGEX_PASSWORD = /^(?=\S*[a-z])(?=\S*[A-Z])(?=\S*\d)(?=\S*([^\w\s]|[_]))\S{8,}$/;
const REGEX_SLUG     = /^[a-z0-9\-]+$/;
const REGEX_UID      = /^[A-Za-z0-9_\-]+$/;
const REGEX_UIDS     = /^[A-Za-z0-9_\-,]+$/;
const REGEX_NUMERIC  = /^\d+$/;

const VALIDATE_UIDS = {
  uids: {
    required: true,
    regex: REGEX_UIDS,
    transform: (d) => Array.isArray(d)? d: d.split(',')
  }
}

const VALIDATE_OPTIONAL_UIDS = {
  uids: {
    required: false,
    regex: REGEX_UIDS,
    transform: (d) => d.split(',')
  }
}

const VALIDATE_EMAIL = {
  email: {
    required: true,
    regex: REGEX_EMAIL
  }
}

const VALIDATE_OPTIONAL_GITHUB_ID = {
  githubId: {
    required: false,
    regex: REGEX_NUMERIC
  }
}

const VALIDATE_OPTIONAL_EMAIL = {
  email: {
    required: false,
    regex: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  }
}

const VALIDATE_PASSWORD = {
  password: {
    required: true,
    regex: REGEX_PASSWORD
  }
}

const VALIDATE_OPTIONAL_PASSWORD = {
  password: {
    required: false,
    regex: REGEX_PASSWORD,
  }
}

/*
  Validate data field for POST and GET request.
  Note: it creates context.data.sanitized.
*/
const validate = ( validators, method='GET') => {
  return async context => {
    if(!validators)
      return;
    debug('validate: <validators keys>', Object.keys(validators));

    if(method === 'GET') {
      debug('validate: GET data', context.params.query);
      const validated = _validate(context.params.query, validators);
      if(!context.params.sanitized)
        context.params.sanitized = validated
      else
        Object.assign(context.params.sanitized, validated)
      return;
    } else {
      debug('validate: POST data');
      context.data.sanitized = _validate(context.data, validators)
    }
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
const queryWithCommonParams = (replaceQuery=true) => {
  return async context => {
    let params = {
      limit: 10,
      skip: 0,
      max_limit: 500
    }

    if(params.user){
      console.log(params.user)
    }
    // num of results expected, 0 to 500
    if(context.params.query.limit) {
      let limit = parseInt(context.params.query.limit);
      params.limit = +Math.min(Math.max(0, limit), params.max_limit || 500)
    }
    // transform page in corresponding SKIP. Page is 1-n.
    if(context.params.query.page) {
      let page = Math.max(1, parseInt(context.params.query.page));
      // transform in skip and offsets. E.G page=4 when limit = 10 results in skip=30 page=2 in skip=10, page=1 in skip=0
      params.skip = (page-1) * params.limit;
      params.page = page;
    } else if(context.params.query.offset) {
      params.skip = Math.max(0, parseInt(context.params.query.offset));
    } else if(context.params.query.skip) {
      params.skip = Math.max(0, parseInt(context.params.query.skip));
    }

    debug("queryWithCommonParams: <params>", params);

    if(replaceQuery) {
      context.params.isSafe = true;

      context.params.query = {
        ... context.params.sanitized || {}, // add validated params, if any
        ... params
      }
    } else {

      context.params.sanitized = params
      debug("queryWithCommonParams: do not replace context.params.query.");

    }
  }
}

/*
  forward strategy to handle params correctly
*/
const forwardStrategy = () => {
  return async context => {


  }
}
/*
  Add sanitized parameter to context result.
*/
const verbose = () => {
  return async context => {
    context.result = Array.isArray(context.result)? { result: context.result }: {};
    context.result.params = context.params.sanitized;
  }
}

/**
 * Before hook to validate
 *
 * @param {string} paramName
 * @param {array} validators
 * @param {object} options optional, with `required` and `method`
 */
const validateEach = (paramName, validators, options={}) => {
  const opts = {
    required: false,
    method: 'GET',
    ... options
  }

  return async context => {
    if (context.type !== 'before') {
      throw new Error(`The 'validateEach' hook should only be used as a 'before' hook.`);
    }
    // console.log(context.params.query.filters)
    const toBeValidated = opts.method == 'GET'? context.params.query[paramName]: context.data[paramName];

    if(!Array.isArray(toBeValidated) || !toBeValidated.length) {
      if(opts.required) {
        let _error = {};
        _error[paramName] = {
          code: 'NotFound',
          message: `param '${paramName}' is required and shouldn't be empty.`
        }
        throw new errors.BadRequest(_error);
      }
      debug(`validateEach: ${paramName} not found in '${opts.method}' or is not an Array or it is empty. Received:`, toBeValidated);
      // throw new Error(`The param ${paramName} should exist and be an array.`);
      return;
    }
    debug(`validateEach: '${paramName}' in '${opts.method}'. Received:`, toBeValidated);
    //_validate(context.query, validators)
    const validated = toBeValidated.map((d) => {
      let _d = _validate(d, validators, opts.method);
      // add mustache friendly conditionals based on type. e.g; isIssue or isNewspaper
      _d[`_is${d.type}`] = true;
      return _d;
    });

    if (opts.method == 'GET') {
      if(!context.params.sanitized) {
        context.params.sanitized = {}
      }
      context.params.sanitized[paramName] = validated;
    } else {
      if(!context.data.sanitized) {
        context.data.sanitized = {}
      }
      context.data.sanitized[paramName] = validated;
    }
  }
}

const displayQueryParams = (paramNames = []) => {
  return async context => {
    if (context.type !== 'after') {
      throw new Error(`The 'displayQueryParams' hook should only be used as a 'after' hook.`);
    }
    debug(`displayQueryParams: ${paramNames}`);
    if(!context.result.info) {
      context.result.info = {}
    }
    paramNames.forEach(p => {
      context.result.info[p] = context.params.sanitized[p];
    });
  }
}

module.exports = {
  displayQueryParams,
  forwardStrategy,
  verbose,
  validate,
  validateEach,
  queryWithCommonParams,


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

  utils: {
    toOrderBy,
    toLucene
  }
}
