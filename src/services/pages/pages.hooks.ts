import { HookOptions } from '@feathersjs/feathers'
import { queryWithCommonParams, validate } from '@/hooks/params.js'
import { BinaryFilterInputValues } from '@/services/pages/pages.schema.js'
import { PagesService } from '@/services/pages/pages.class.js'
import { ImpressoApplication } from '@/types.js'

const PAGE_ID_REGEX = /^[A-Za-z0-9]+-\d{4}-\d{2}-\d{2}-[a-z]-p\d+$/
const ISSUE_ID_REGEX = /^[A-Za-z0-9]+-\d{4}-\d{2}-\d{2}-[a-z]$/
const MEDIA_SOURCE_ID_REGEX = /^[A-Za-z0-9_-]+$/

type BinaryInput = (typeof BinaryFilterInputValues)[number]

interface FindParams {
  id?: string[]
  issue_id?: string[]
  num?: number[]
  hasCoords?: number[]
  hasErrors?: number[]
  iiif?: string[]
  mediaSourceId?: string[]
}

const toArray = (item?: string | string[]): string[] | undefined => {
  if (Array.isArray(item)) {
    return item
  }
  if (typeof item === 'string') {
    return [item]
  }
  return undefined
}

const toNormalizedStringArray = (item?: string | string[]) =>
  toArray(item)
    ?.map(value => value.trim())
    .filter(value => value.length > 0)

const toBinaryInt = (item: string): number => {
  const value = item.toLowerCase()
  return value === '1' || value === 'true' ? 1 : 0
}

const isValidNumberList = (item: string | string[] | undefined) =>
  (toArray(item) ?? []).every(value => /^\d+$/.test(value))

const isValidIiifList = (item: string | string[] | undefined) =>
  (toNormalizedStringArray(item) ?? []).every(value => value.length <= 200)

export default {
  before: {
    find: [
      validate<FindParams>({
        id: {
          required: false,
          fn: item => (toNormalizedStringArray(item) ?? []).every(value => PAGE_ID_REGEX.test(value)),
          transform: item => toNormalizedStringArray(item),
        },
        issue_id: {
          required: false,
          fn: item => (toNormalizedStringArray(item) ?? []).every(value => ISSUE_ID_REGEX.test(value)),
          transform: item => toNormalizedStringArray(item),
        },
        num: {
          required: false,
          fn: isValidNumberList,
          transform: item => (toArray(item) ?? []).map(value => Number.parseInt(value, 10)),
        },
        hasCoords: {
          required: false,
          before: item => toArray(item)?.map(value => value.toLowerCase() as BinaryInput),
          choices: [...BinaryFilterInputValues],
          transform: item => (toArray(item) ?? []).map(toBinaryInt),
        },
        hasErrors: {
          required: false,
          before: item => toArray(item)?.map(value => value.toLowerCase() as BinaryInput),
          choices: [...BinaryFilterInputValues],
          transform: item => (toArray(item) ?? []).map(toBinaryInt),
        },
        iiif: {
          required: false,
          fn: isValidIiifList,
          transform: item => toNormalizedStringArray(item),
        },
        mediaSourceId: {
          required: false,
          fn: item => (toNormalizedStringArray(item) ?? []).every(value => MEDIA_SOURCE_ID_REGEX.test(value)),
          transform: item => toNormalizedStringArray(item),
        },
      }),
      queryWithCommonParams(),
    ],
    get: [queryWithCommonParams()],
  },
} as HookOptions<ImpressoApplication, PagesService>
