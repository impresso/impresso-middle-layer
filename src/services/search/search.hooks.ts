import { authenticateAround } from '@/hooks/authenticate.js'

export default {
  around: {
    find: [authenticateAround({ allowUnauthenticated: true })],
  },
}
