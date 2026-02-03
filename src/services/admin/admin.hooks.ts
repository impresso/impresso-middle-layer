import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { staffOnly } from '@/util/users.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: false }), staffOnly],
  },
}
