import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
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
} from '@/hooks/params.js'
import { hooks } from '@feathersjs/authentication-local'

const { protect } = hooks

const trimOptionalString = (item: string | string[] | undefined) => (typeof item === 'string' ? item.trim() : undefined)

interface FindData {
  uid?: string
  email?: string
  githubId?: string
}

interface CreateData {
  username?: string
  firstname?: string
  lastname?: string
  displayName?: string
  plan?: string
  affiliation?: string
  institutionalUrl?: string
  pattern?: string
  email?: string
  password?: string
}

interface PatchData {
  password?: string
}

export default {
  around: {
    get: [authenticate()],
    find: [authenticate()],
    update: [authenticate()],
    patch: [authenticate()],
    remove: [authenticate()],
  },
  before: {
    all: [],
    find: [
      validate<FindData>({
        ...VALIDATE_OPTIONAL_UID,
        ...VALIDATE_OPTIONAL_EMAIL,
        ...VALIDATE_OPTIONAL_GITHUB_ID,
      }),
      queryWithCommonParams(),
    ],
    create: [
      validate<CreateData>(
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
            choices: ['plan-basic', 'plan-educational', 'plan-researcher'],
            defaultValue: 'plan-basic',
          },
          affiliation: {
            required: false,
            max_length: 255,
            regex: /^[\p{L}\p{N}\s\-().,'&/]+$/u,
            transform: trimOptionalString,
          },
          institutionalUrl: {
            required: false,
            max_length: 200,
            regex: /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-._~:/?#[\]@!$&'()*+,;=]*)?$/,
            transform: trimOptionalString,
          },
          pattern: {
            required: false,
            regex: /^#[0-9a-fA-F]{2,6}(,#[0-9a-fA-F]{2,6})*$/,
          },
          ...VALIDATE_EMAIL,
          ...VALIDATE_PASSWORD,
        },
        'POST'
      ),
    ],
    update: [],
    patch: [
      validate<PatchData>(
        {
          ...VALIDATE_OPTIONAL_PASSWORD,
        },
        'POST'
      ),
    ],
  },
  after: {
    all: [protect('password'), protect('salt')],
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
