import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams, utils, validate } from '@/hooks/params.js'
import { OrderItem } from 'sequelize'

interface Params {
  order_by?: OrderItem[]
  status?: string[]
}

interface CreatePayload {
  specialMembershipAccessId: number
  notes: string
  isTemporary?: boolean
}

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: false })],
  },
  before: {
    create: [
      validate<CreatePayload>(
        {
          specialMembershipAccessId: {
            required: true,
            fn: item => {
              const value = Array.isArray(item) ? item[0] : item
              return value != null && !Number.isNaN(Number(value))
            },
            transform: item => {
              const value = Array.isArray(item) ? item[0] : item
              return value == null ? undefined : Number(value)
            },
          },
          notes: {
            required: false,
            max_length: 1000,
            fn: item => {
              const value = Array.isArray(item) ? item[0] : item
              return typeof value === 'string' && value.trim().length > 0
            },
            message: 'notes must be a non-empty string up to 1000 characters',
            transform: item => {
              const value = Array.isArray(item) ? item[0] : item
              return typeof value === 'string' ? value.trim() : undefined
            },
          },
          isTemporary: {
            required: false,
            fn: item => {
              const value = (Array.isArray(item) ? item[0] : item) as unknown
              return value === undefined || value === true || value === false || value === 'true' || value === 'false'
            },
            transform: item => {
              const value = (Array.isArray(item) ? item[0] : item) as unknown
              if (value === undefined) return undefined
              return value === true || value === 'true'
            },
          },
        },
        'POST',
        { applyInPlace: true }
      ),
    ],
    find: [
      queryWithCommonParams(),
      validate<Params>(
        {
          order_by: {
            required: false,
            choices: ['-dateLastModified', 'dateLastModified'],
            transform: (d: string | string[] | undefined) => {
              if (!d) return undefined
              const value = Array.isArray(d) ? d[0] : d
              return utils.translate(value, {
                '-dateLastModified': [['dateLastModified', 'DESC']],
                dateLastModified: [['dateLastModified', 'ASC']],
              })
            },
          },
          status: {
            required: false,
            choices: ['pending', 'approved', 'rejected', 'temporary'],
          },
        },
        'GET',
        { applyInPlace: true }
      ),
    ],
  },
}
