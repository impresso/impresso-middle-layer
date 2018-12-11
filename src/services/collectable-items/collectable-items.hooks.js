const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  queryWithCommonParams, validate, validateEach, utils, REGEX_UID, REGEX_UIDS,
} = require('../../hooks/params');

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [
      validate({
        item_uids: {
          required: false,
          regex: REGEX_UIDS,
          after: d => (Array.isArray(d) ? d : d.split(',')),
        },
        order_by: {
          choices: ['-date', 'date'],
          defaultValue: '-date',
          transform: d => utils.translate(d, {
            date: [['date_added', 'ASC']],
            '-date': [['date_added', 'DESC']],
          }),
        },
      }, 'GET'),
      queryWithCommonParams(),
    ],
    get: [],
    create: [
      validate({
        collection_uid: {
          required: true,
          regex: REGEX_UID,
        },
      }, 'POST'),
      validateEach('items', {
        content_type: {
          choices: ['article', 'entity', 'page', 'issue'],
          required: true,
          transform: d => utils.translate(d, {
            article: 'A',
            entity: 'E',
            page: 'P',
            issue: 'I',
          }),
        },
        uid: {
          regex: REGEX_UID,
          required: true,
        },
      }, {
        required: true,
        method: 'POST',
      }),
    ],
    update: [],
    patch: [],
    remove: [
      validate({
        collection_uid: {
          required: true,
          regex: REGEX_UID,
        },
      }, 'GET'),
      validateEach('items', {
        uid: {
          regex: REGEX_UID,
          required: true,
        },
      }, {
        required: true,
        method: 'GET',
      }),
    ],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
