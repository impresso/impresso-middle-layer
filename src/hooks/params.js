const errors = require('@feathersjs/errors');
const debug = require('debug')('impresso/hooks:params');
const { Op } = require('sequelize');
const { assignIn } = require('lodash');

const toSequelizeLike = (query) => {
  // replace all non nice characters.
  // for a two spaces word like "accent octoup", outputs:
  // {
  //   [Op.and]: [
  //     {[Op.like]: '%accen%',}
  //     {[Op.like]: '%octoup%',}
  //   ],
  // },
  const escapeds = query.split(/\s+/).map(d => ({
    [Op.like]: `%%${d.replace(/[%()]/g, '')}%`,
  }));

  if (escapeds.length > 1) {
    return {
      [Op.and]: escapeds,
    };
  }
  return escapeds.pop();
};

const toLucene = (query, forceFuzzy = true) => {
  // @todo excape chars + - && || ! ( ) { } [ ] ^ " ~ * ? : \

  // replace query
  // const Q = '(:D)'; // replace quotes
  // const S = '[-_°]'; // replace spaces

  // understand \sOR\s and \sAND\s stuff.
  if (query.indexOf(' OR ') !== -1 || query.indexOf(' AND ') !== -1) {
    // this is a real lucene query.
    debug('toLucene: actual <lucene query>', query);
    return query;
  }
  // split by quotes.
  let _forceFuzzy = forceFuzzy;

  // console.log('word1 , "word2 , , word3 " , word 5 ",
  // word 6 , "word7 , "word8 }'.split(/("[^"]*?")/))
  // console.log('ciao "mamma "bella" e ciao'.split(/("[^"]*?")/))

  // avoid lexical error (odd number of quotes for instance)
  const q = query.split(/("[^"]*?")/).map((d) => {
    // trim spaces
    let _d = d.trim();

    // we find here
    if (_d.indexOf('"') === 0 && _d.lastIndexOf('"')) {
      // leave as it is
      return _d;
    }

    // trust the user
    if (_d.indexOf('*') !== -1 && _forceFuzzy) { _forceFuzzy = false; }

    // strip quotes
    _d = _d.replace(/"/g, '');

    // get rid of one letter words, multiple spaces and concatenate with simple space for the moment
    const _dr = _d.split(/\s+/).filter(k => k.length > 1);

    // if there is only one word
    if (_dr.length === 1) {
      _d = _dr.join(' ');
      return _forceFuzzy ? `${_d}*` : _d;
    }

    // _dr contains COMMA? @todo
    return _dr.join(' AND ');
  }).join(' AND ');
  debug('toLucene: <natural query>', query, 'to <lucene query>', q);
  return q;
};


const toOrderBy = (ordering, translateTable, lower = false) => {
  // TODO if ordering is array;
  if (ordering.indexOf('-') === 0) {
    const _ordering = translateTable[ordering.substr(1)];
    return lower ? `${_ordering} desc` : `${_ordering} DESC`;
  }
  const _ordering = translateTable[ordering];
  return lower ? `${_ordering} asc` : `${_ordering} ASC`;
};

const translate = (key, dict) => dict[key];

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
const orderBy = ({
  values = {},
  defaultValue = undefined,
  required = false,
} = {}) => ({
  before: (d) => {
    if (typeof d === 'string') {
      return d.split(',');
    }
    return d;
  },
  choices: Object.keys(values),
  defaultValue,
  required,
  transform: d => translate(d, values),
  after: (d) => {
    if (Array.isArray(d)) {
      return d.join(',');
    }
    return d;
  },
});

/**
 * [facets description]
 * @param  {Object} [values={}]         [description]
 * @param  {String} [defaultValue=null] [optional]
 * @return {Object}                     [description]
 */
const facets = ({
  values = {},
  defaultValue = undefined,
  required = false,
} = {}) => ({
  before: (d) => {
    if (typeof d === 'string') {
      return d.split(',');
    }
    return d;
  },
  choices: Object.keys(values),
  defaultValue,
  required,
  transform: d => ({
    ...translate(d, values),
    facet: d,
  }), // translate(d, values),
  after: (fields) => {
    const _facets = {};
    fields.forEach((field) => {
      _facets[field.facet] = values[field.facet];
    });
    return JSON.stringify(_facets);
  },
});

const _validateOne = (key, item, rule) => {
  const _errors = {};
  let _item;
  // it is required
  if (typeof item === 'undefined' || item === null) {
    if (rule.required === true) {
      _errors[key] = {
        code: 'NotFound',
        message: `${key} required`,
      };
    } else if (rule.defaultValue) {
      _item = rule.defaultValue;
    } else {
      return null;
    }
  }

  if (rule.max_length && item.length > rule.max_length) {
    _errors[key] = {
      code: 'NotValidLength',
      message: rule.message || `${key} param is not valid`,
    };
  }
  if (rule.min_length && item.length < rule.min_length) {
    _errors[key] = {
      code: 'NotValidLength',
      message: rule.message || `${key} param is not valid`,
    };
  }
  if (rule.choices && rule.choices.indexOf(item) === -1) {
    _errors[key] = {
      code: 'NotInArray',
      ref: rule.choices,
      message: rule.message || `${key} param is not valid`,
    };
  }

  if (rule.regex && !rule.regex.test(item)) {
    _errors[key] = {
      code: 'NotValidRegex',
      regex: rule.regex.toString(),
      message: rule.message || `${key} param is not valid`,
    };
  }

  if (rule.fn && rule.fn(item) !== true) {
    _errors[key] = {
      code: 'NotValidCustomFunction',
      message: rule.message || `${key} param is not valid`,
    };
  }

  if (Object.keys(_errors).length) {
    debug('_validateOne: errors:', _errors);
    throw new errors.BadRequest(_errors);
  }

  // sanitize/transform params
  if (typeof rule.transform === 'function') {
    _item = rule.transform(item);
  } else {
    _item = item;
  }


  return _item;
};

const _validate = (params, rules) => {
  const _params = {};
  const _errors = {};

  Object.keys(rules).forEach((key) => {
    if (typeof params[key] === 'undefined') {
      if (rules[key] && rules[key].required) {
        // required!
        _errors[key] = {
          code: 'NotFound',
          message: `${key} required`,
        };
      } else if (typeof rules[key].defaultValue !== 'undefined') {
        _params[key] = _validateOne(key, rules[key].defaultValue, rules[key]);
      }
    } else {
      // special before hook (e.g; split comma separated values before applying a rule)
      if (typeof rules[key].before === 'function') {
        params[key] = rules[key].before(params[key]);
      }
      // it is an Array of values
      if (Array.isArray(params[key])) {
        _params[key] = params[key].map(d => _validateOne(key, d, rules[key]));
      } else {
        _params[key] = _validateOne(key, params[key], rules[key]);
      }
      // special after hook
      if (typeof rules[key].after === 'function') {
        _params[key] = rules[key].after(_params[key]);
      }
    }
  });
  if (Object.keys(_errors).length) {
    debug('_validate: got errors', _errors);
    throw new errors.BadRequest(_errors);
  }
  return _params;
};

const REGEX_EMAIL = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const REGEX_PASSWORD = /^(?=\S*[a-z])(?=\S*[A-Z])(?=\S*\d)(?=\S*([^\w\s]|[_]))\S{8,}$/;
const REGEX_SLUG = /^[a-z0-9-]+$/;
const REGEX_UID = /^[A-zÀ-Ÿ0-9_."'-]+$/;
const REGEX_UIDS = /^[A-zÀ-Ÿ0-9_.,"'-]+[A-zÀ-Ÿ0-9_.,"'-]+$/;
const REGEX_NUMERIC = /^\d+$/;


const VALIDATE_OPTIONAL_UID = {
  uid: {
    required: false,
    regex: REGEX_UID,
  },
};

const VALIDATE_UIDS = {
  uids: {
    required: true,
    regex: REGEX_UIDS,
    transform: d => (Array.isArray(d) ? d : d.split(',')),
  },
};

const VALIDATE_OPTIONAL_UIDS = {
  uids: {
    required: false,
    regex: REGEX_UIDS,
    transform: d => (Array.isArray(d) ? d : d.split(',')),
  },
};

const VALIDATE_EMAIL = {
  email: {
    required: true,
    regex: REGEX_EMAIL,
  },
};

const VALIDATE_OPTIONAL_GITHUB_ID = {
  githubId: {
    required: false,
    regex: REGEX_NUMERIC,
  },
};

const VALIDATE_OPTIONAL_EMAIL = {
  email: {
    required: false,
    regex: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  },
};

const VALIDATE_PASSWORD = {
  password: {
    required: true,
    regex: REGEX_PASSWORD,
  },
};

const VALIDATE_OPTIONAL_PASSWORD = {
  password: {
    required: false,
    regex: REGEX_PASSWORD,
  },
};

/*
  Validate data field for POST and GET request.
  Note: it creates context.data.sanitized.
*/
const validate = (validators, method = 'GET') => async (context) => {
  if (!validators) { return; }
  debug('validate: <validators keys>',
    `${context.path}.${context.method}`,
    Object.keys(validators));

  if (method === 'GET') {
    debug('validate: GET data', context.params.query);
    const validated = _validate(context.params.query, validators);
    if (!context.params.sanitized) {
      context.params.sanitized = validated;
    } else {
      Object.assign(context.params.sanitized, validated);
    }
  } else {
    debug('validate: POST data');
    context.data.sanitized = assignIn(
      {}, context.data.sanitized, _validate(context.data, validators),
    );
  }
};

const validateRouteId = () => async (context) => {
  if (context.id && !(REGEX_UID.test(context.id) || REGEX_UIDS.test(context.id))) {
    debug('validateRouteId: context.id not matching REGEX_UIDS');
    throw new errors.BadRequest('route id is not valid');
  }
};


const queryWithCurrentExecUser = () => async (context) => {
  if (!context.params) {
    context.params = {};
  }

  if (!context.params.query) {
    context.params.query = {};
  }

  if (context.params.user) {
    debug(`queryWithCurrentExecUser: add '_exec_user_uid':'${context.params.user.uid}' to the query `);
    context.params.query._exec_user_uid = context.params.user.uid;
    context.params.query._exec_user_is_staff = context.params.user.is_staff
      || context.params.user.isStaff;
  } else {
    debug('queryWithCurrentExecUser: cannot add \'_exec_user_uid\', no user found in \'context.params\'');
  }
};

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
const queryWithCommonParams = (replaceQuery = true, method = 'GET') => async (context) => {
  const params = {
    limit: 10,
    skip: 0,
    max_limit: 1000,
  };

  if (!context.params) {
    context.params = {};
  }

  if (!context.params.query) {
    context.params.query = {};
  }

  if (context.params.user) {
    debug(`queryWithCommonParams: adding '_exec_user_uid' to the query ${context.params.user.uid}`);
    params._exec_user_uid = context.params.user.uid;
    params._exec_user_is_staff = context.params.user.is_staff;
  }

  const originObject = method === 'GET' ? context.params.query : context.data;
  const destinationObject = method === 'GET' ? context.params : context.data;

  // num of results expected, 0 to 500
  if (originObject.limit > -1) {
    const limit = parseInt(originObject.limit, 10);
    params.limit = +Math.min(Math.max(0, limit), params.max_limit || 500);
  }
  // transform page in corresponding SKIP. Page is 1-n.
  if (originObject.page) {
    const page = Math.max(1, parseInt(originObject.page, 10));
    // transform in skip and offsets. E.G page=4 when limit = 10
    // results in skip=30 page=2 in skip=10, page=1 in skip=0
    params.skip = (page - 1) * params.limit;
    params.page = page;
  } else if (originObject.offset) {
    params.skip = Math.max(0, parseInt(originObject.offset, 10));
  } else if (originObject.skip) {
    params.skip = Math.max(0, parseInt(originObject.skip, 10));
  }


  if (replaceQuery && method === 'GET') {
    context.params.isSafe = true;
    context.params.originalQuery = {
      ...context.params.query,
    };
    context.params.query = {
      ...context.params.sanitized || {}, // add validated params, if any
      ...params,
    };
    debug(`queryWithCommonParams (replaceQuery:${replaceQuery}), <context.params.query>:`, context.params.query);
  } else {
    destinationObject.sanitized = assignIn({}, destinationObject.sanitized, params);
    const field = method === 'GET' ? 'context.params' : 'context.data';
    debug(`queryWithCommonParams: appends params to '${field}.sanitized': ${JSON.stringify(params)}`);
  }
};


/*
  Add sanitized parameter to context result.
*/
const verbose = () => async (context) => {
  context.result = Array.isArray(context.result) ? { result: context.result } : {};
  context.result.params = context.params.sanitized;
};

/**
 * Before hook to validate
 *
 * @param {string} paramName
 * @param {array} validators
 * @param {object} options optional, with `required` and `method`
 */
const validateEach = (paramName, validators, options = {}) => {
  const opts = {
    required: false,
    method: 'GET',
    ...options,
  };

  return async (context) => {
    if (context.type !== 'before') {
      throw new Error('The \'validateEach\' hook should only be used as a \'before\' hook.');
    }
    // console.log(context.params.query.filters)
    let toBeValidated;

    if (opts.method === 'GET') {
      toBeValidated = context.params.query[paramName];
    } else if (opts.method === 'POST') {
      toBeValidated = context.data[paramName];
    }

    if (!Array.isArray(toBeValidated) || !toBeValidated.length) {
      if (opts.required) {
        const _error = {};
        _error[paramName] = {
          code: 'NotFound',
          message: `param '${paramName}' is required and shouldn't be empty.`,
        };
        // console.log(_error);
        throw new errors.BadRequest(_error);
      }
      debug(`validateEach: ${opts.required ? 'required' : 'optional'} ${paramName} not found in '${opts.method}' or is not an Array or it is empty. Received:`, toBeValidated);
      // throw new Error(`The param ${paramName} should exist and be an array.`);
      return;
    }
    debug(`validateEach: '${paramName}' in '${opts.method}'. Received:`, toBeValidated);
    // _validate(context.query, validators)
    const validated = toBeValidated.map((d) => {
      const _d = _validate(d, validators, opts.method);
      // add mustache friendly conditionals based on type. e.g; isIssue or isNewspaper
      // _d[`_is${d.type}`] = true;
      return _d;
    });

    if (opts.method === 'GET') {
      if (!context.params.sanitized) {
        context.params.sanitized = {};
      }
      context.params.sanitized[paramName] = validated;
    } else {
      if (!context.data.sanitized) {
        context.data.sanitized = {};
      }
      context.data.sanitized[paramName] = validated;
    }
  };
};

const displayQueryParams = (paramNames = []) => async (context) => {
  if (context.type !== 'after') {
    throw new Error('The \'displayQueryParams\' hook should only be used as a \'after\' hook.');
  }
  debug(`displayQueryParams: ${paramNames}`);
  if (!context.result.info) {
    context.result.info = {};
  }
  paramNames.forEach((p) => {
    if (context.params && context.params.sanitized && context.params.sanitized[p]) {
      context.result.info[p] = context.params.sanitized[p];
    }
  });
};

const protect = (...fields) => async (context) => {
  fields.forEach((p) => {
    if (Array.isArray(context.result.data)) {
      context.result.data = context.result.data.map((d) => {
        delete d[p];
        return d;
      });
    } else {
      delete context.result[p];
    }
  });
};

module.exports = {
  displayQueryParams,

  protect,

  verbose,
  validate,
  validateEach,
  queryWithCommonParams,
  queryWithCurrentExecUser,

  sanitize: _validate,

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

  utils: {
    orderBy,
    facets,
    toOrderBy,
    toLucene,
    translate,
    toSequelizeLike,
  },
};
