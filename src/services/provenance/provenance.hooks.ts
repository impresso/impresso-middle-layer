import { authenticate } from '@feathersjs/authentication'
export default { before: { all: [authenticate('jwt')] } }
