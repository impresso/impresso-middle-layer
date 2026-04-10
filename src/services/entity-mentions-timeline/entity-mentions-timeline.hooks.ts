import { validateWithSchema } from '@/hooks/schema.js'
import { newAjvInstance } from '@/util/json.js'

const validationInstance = newAjvInstance([
  ['schema/canonical/Filter.json', 'schema/canonical/Filter.json'],
  ['services/entity-mentions-timeline/schema/create/payload.json', 'request'],
  ['services/entity-mentions-timeline/schema/create/response.json', 'response'],
])

export default {
  before: {
    all: [],
    find: [],
    get: [],
    create: [validateWithSchema('request', validationInstance)],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [validateWithSchema('response', validationInstance, 'result')],
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
