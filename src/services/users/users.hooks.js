import { authenticateAround as authenticate } from '../../hooks/authenticate'
import {
  queryWithCommonParams,
  validate,
  VALIDATE_OPTIONAL_UID,
  VALIDATE_OPTIONAL_GITHUB_ID,
  VALIDATE_OPTIONAL_EMAIL,
  VALIDATE_EMAIL,
  VALIDATE_PASSWORD,
  VALIDATE_OPTIONAL_PASSWORD,
  REGEX_SLUG,
} from '../../hooks/params'
import { hooks } from '@feathersjs/authentication-local'

const { protect } = hooks

export default {
  around: {
    get: [authenticate('jwt')],
    find: [authenticate('jwt')],
    update: [authenticate('jwt')],
    patch: [authenticate('jwt')],
    remove: [authenticate('jwt')],
  },
  before: {
    all: [],
    find: [
      validate({
        ...VALIDATE_OPTIONAL_UID,
        ...VALIDATE_OPTIONAL_EMAIL,
        ...VALIDATE_OPTIONAL_GITHUB_ID,
      }),
      queryWithCommonParams(),
    ],
    create: [
      validate(
        {
          username: {
            required: true,
            regex: REGEX_SLUG,
            max_length: 100,
          },
          firstname: {
            required: true,
            max_length: 30,
          },
          lastname: {
            required: true,
            max_length: 150,
          },
          displayName: {
            required: true,
            max_length: 100,
          },
          plan: {
            required: false,
            // align to configuration AvailablePlansConfiguration choices
            choices: ['plan-basic', 'plan-educational', 'plan-researcher'],
            default: 'plan-basic',
          },
          affiliation: {
            required: false,
            max_length: 255,
            regex: /^[\p{L}\p{N}\s\-().,'&/]+$/u,
            transform: d => d.trim(),
          },
          institutionalUrl: {
            required: false,
            max_length: 200,
            // /^(https?:\/\/)?([\w\-]+\.)+[\w\-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/
            regex: /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-._~:/?#[\]@!$&'()*+,;=]*)?$/,
            transform: d => d.trim(),
          },
          pattern: {
            required: false,
            regex: /^#[0-9a-fA-F]{2,6}(,#[0-9a-fA-F]{2,6})*$/,
          },
          ...VALIDATE_EMAIL,
          ...VALIDATE_PASSWORD,
          // ...VALIDATE_OPTIONAL_GITHUB_ID,
        },
        'POST'
      ),
    ],
    update: [
      // hashPassword(),
    ],
    patch: [
      // hashPassword(),
      //

      validate(
        {
          ...VALIDATE_OPTIONAL_PASSWORD,
        },
        'POST'
      ),
    ],
  },

  after: {
    all: [
      // Make sure the password field is never sent to the client
      // Always must be the last hook
      protect('password'),
      protect('salt'),
    ],
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
}
