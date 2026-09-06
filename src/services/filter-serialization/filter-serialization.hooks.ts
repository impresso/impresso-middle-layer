import { validateWithSchema } from '@/hooks/schema.js'
import { newAjvInstance } from '@/util/json.js'

const validationInstance = newAjvInstance([
  ['schema/entities/Filter.json', 'schema/entities/Filter.json'],
  ['schema/entities/Filter.json', 'entities/Filter.json'],
  ['schema/app/requests/FilterSerializationRequest.json', 'request'],
  ['schema/app/responses/FilterSerializationResponse.json', 'response'],
])

export default {
  before: {
    create: [validateWithSchema('request', validationInstance)],
  },
  after: {
    create: [validateWithSchema('response', validationInstance, 'result')],
  },
}
