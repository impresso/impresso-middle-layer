const errors = require('@feathersjs/errors');
const crypto = require('crypto');
const configuration  = require('@feathersjs/configuration')()();
const debug = require('debug')('impresso/hooks:params');

const _toLucene = (query, force_fuzzy=true) => {
  // @todo excape chars + - && || ! ( ) { } [ ] ^ " ~ * ? : \

  // replace query
  var Q = '(:D)', // replace quotes
      S = '[-_°]', // replace spaces
      q;

  // understand \sOR\s and \sAND\s stuff.
  if(query.indexOf(' OR ') !== -1 || query.indexOf(' AND ') !== -1){
    // this is a real lucene query.
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

  return q;
}

const _validate = (params, rules) => {
  let _params = {},
      _errors = {};

  for(let key in rules){
    // it is required
    if(rules[key].required === true && typeof params[key] == 'undefined'){

      _errors[key] =  {
        code: 'NotFound',
        message: key + ' required'
      };
      break;
    } else if(typeof params[key] == 'undefined'){

      continue;
    }

    if(rules[key].max_length && params[key].length > rules[key].max_length) {
      _errors[key] =  {
        code: 'NotValidLength',
        message: rules[key].message || key + ' param is not valid'
      };
      break;
    }
    if(rules[key].min_length && params[key].length < rules[key].min_length) {
      _errors[key] =  {
        code: 'NotValidLength',
        message: rules[key].message || key + ' param is not valid'
      };
      break;
    }
    if(rules[key].choices && rules[key].choices.indexOf(params[key]) === -1) {
      _errors[key] =  {
        code: 'NotInArray',
        message: rules[key].message || key + ' param is not valid'
      };
      break;
    }

    if(rules[key].regex && !rules[key].regex.test(params[key])) {
      _errors[key] =  {
        code: 'NotValidRegex',
        regex: rules[key].regex.toString(),
        message: rules[key].message || key + ' param is not valid'
      };
      break;
    }

    if(rules[key].fn && rules[key].fn(params[key]) !== true) {
      _errors[key] =  {
        code: 'NotValidCustomFunction',
        message: rules[key].message || key + ' param is not valid'
      };
      break;
    }

    // sanitize/transform params
    if(typeof rules[key].transform == 'function'){
      _params[key] = rules[key].transform(params[key]);
    } else {
      _params[key] = params[key]
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
const validate = ( validators ) => {
  return async context => {
    if(!validators)
      return;
    debug('validate: <validators keys>', Object.keys(validators));

    if(context.data){
      context.data.sanitized = _validate(context.data, validators)
      debug('validate: POST data');
    } else {
      debug('validate: GET data');
      Object.assign(context.params.sanitized, _validate(context.params.query, validators))
    }
  }
}

/*
  Clean params before sending them to the actual function.
  "Sanitized" params will be available as
  `context.params.sanitized`

  usage in service "before" hooks:

  ```
  before: {
    all: [
      sanitize({
        validators: {
          newspaper: {
            required: false,
            regex: /^[a-z0-9_\-]+$/
          }
        },
      })
    ], //authenticate('jwt') ],
    find: [],
    get: [],
  }
  ```
  Then in the Service class:
  ````
  class Service {
    constructor (options) {
    }

    find (params) {
      return this.dosomething(params.sanitized)
    }
  ```
*/
const sanitize = ( options ) => {
  return async context => {
    let _options = options || {};
    if(!context.params.query) {
      return
    }
    // initialize with common validators plus optional validators. Ignore page and offsets (those are warnings)
    let validated = _validate(context.params.query, {
      uid: {
        required: false,
        regex: /^[A-Za-z0-9_\-]+$/
      },
      newspaper: {
        required: false,
        regex: /^[A-Za-z0-9_\-]+$/
      },
      newspapers__in: {
        required: false,
        regex: /^[A-Za-z0-9_\-,]+$/,
        transform: (d) => d.split(/\s*,\s*/)
      },
      ... _options.validators
    });

    // console.log(context.params.query.filters)
    // write params to current result
    let params = {
      limit: 10,
      skip: 0,
      max_limit: 500,
      ... validated
    };

    // filter parameters!
    if(context.params.query.filters && Array.isArray(context.params.query.filters)){
      params.filters = [];
      for (let k in context.params.query.filters) {
        // console.log(context.params.query.filters[k])

        let valid = _validate(context.params.query.filters[k], {
          context: {
            required: false,
            choices: ['include','exclude']
          },
          uid: {
            required: false // should be true in case of type === 'NamedEntity'
          },
          type: {
            required: true,
            choices: ['String', 'NamedEntity']
          }
        });
        params.filters.push(valid)
      }
    }

    // :: q
    if(params.q) {
      params._q = _toLucene(params.q)
    }

    // :: order by
    if(context.params.query.order_by) {
      // split commas, then filter useless stuffs.
      let orders = context.params.query.order_by.split(/\s*,\s*/)
      // params.orders = orders;
      // console.log(params)

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


    // add sanitized dict to context params.
    context.params.sanitized = params;
    // console.log(context.params.sanitized)
  }
}

/*
  Prepare common query parameters, adding them to context.params.sanitized.
  Use it as BEFORE hook
*/
const queryWithCommonParams = (replaceQuery=true) => {
  return async context => {
    let params = {
      limit: 10,
      skip: 0,
      max_limit: 500
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




module.exports = {
  forwardStrategy,
  sanitize,
  verbose,
  validate,
  queryWithCommonParams,

  VALIDATE_OPTIONAL_GITHUB_ID,
  VALIDATE_OPTIONAL_EMAIL,
  VALIDATE_OPTIONAL_PASSWORD,
  VALIDATE_EMAIL,
  VALIDATE_PASSWORD,
  VALIDATE_UIDS,

  // common regex
  REGEX_EMAIL,
  REGEX_NUMERIC,
  REGEX_PASSWORD,
  REGEX_SLUG,
  REGEX_UID,
  REGEX_UIDS,

  utils: {
    toLucene: _toLucene
  }
}
