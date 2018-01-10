const errors = require('@feathersjs/errors');


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

    if(rules[key].regex && !rules[key].regex.test(params[key])) {
      _errors[key] =  {
        code: 'NotValidRegex',
        regex: rules[key].regex.toString(),
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
  // console.log(_errors)
  if(Object.keys(_errors).length)
    throw new errors.BadRequest(_errors);
  return _params
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

    // write params to current result
    let params = {
      limit: 10,
      skip: 0,
      max_limit: 500,
      ... validated
    };

    // :: order by
    if(context.params.query.order) {
      // split commas, then filter useless stuffs.
      let orders = context.params.query.order.split(/\s*,\s*/)
      params.orders = orders; 
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
    }
    
    
    // add sanitized dict to context params.
    context.params.sanitized = params;
    console.log(context.params.sanitized)
  }
}

module.exports = {
  sanitize
}