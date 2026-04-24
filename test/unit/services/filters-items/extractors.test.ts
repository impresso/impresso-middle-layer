import { strict as assert } from 'assert'
import type { MediaSource } from '@/models/generated/canonical.js'
import type { ImpressoApplication } from '@/types.js'
import {
  daterangeExtractor,
  floatRangeExtractor,
  integerRangeExtractor,
  newspaperExtractor,
  simpleValueExtractor,
} from '@/services/filters-items/extractors.js'

const createMockAppWithMediaSources = (lookup: Record<string, MediaSource>): ImpressoApplication =>
  ({
    get: () => undefined,
    service: (name: string) => {
      if (name === 'media-sources') {
        return {
          getLookup: async () => lookup,
        }
      }

      if (name === 'collections') {
        return {
          getInternal: async () => {
            throw new Error('collections.getInternal should not be called in newspaperExtractor tests')
          },
        }
      }

      throw new Error(`Unexpected service requested in test: ${name}`)
    },
  }) as unknown as ImpressoApplication

const mediaSourcesLookup: Record<string, MediaSource> = {
  GDL: {
    id: 'GDL',
    type: 'newspaper',
    name: 'Gazette de Lausanne',
    languageCodes: ['fr'],
    publishedPeriodYears: [1800, 1804],
    availableDatesRange: ['1800-01-01', '1804-12-31'],
    totals: {
      articles: 12,
      issues: 4,
      pages: 48,
    },
    properties: [{ id: 'city', label: 'City', value: 'Lausanne' }],
  },
  JDG: {
    id: 'JDG',
    type: 'newspaper',
    name: 'Journal de Geneve',
    languageCodes: ['fr'],
    publishedPeriodYears: [1826, 1828],
    availableDatesRange: ['1826-01-02', '1828-11-30'],
    totals: {
      articles: 7,
      issues: 3,
      pages: 21,
    },
  },
}

describe('filters-items extractors', () => {
  describe('daterangeExtractor', () => {
    it('returns a range from a "start TO end" string', () => {
      const result = daterangeExtractor({ q: '1900-01-01 TO 1950-12-31' })
      assert.deepStrictEqual(result, [{ start: '1900-01-01', end: '1950-12-31' }])
    })

    it('returns a range from a two-element array', () => {
      const result = daterangeExtractor({ q: ['1900-01-01', '1950-12-31'] })
      assert.deepStrictEqual(result, [{ start: '1900-01-01', end: '1950-12-31' }])
    })

    it('handles multiple range strings', () => {
      const result = daterangeExtractor({ q: ['1900-01-01 TO 1910-12-31', '1920-01-01 TO 1930-12-31'] })
      assert.deepStrictEqual(result, [
        { start: '1900-01-01', end: '1910-12-31' },
        { start: '1920-01-01', end: '1930-12-31' },
      ])
    })

    it('returns undefined start/end for malformed input', () => {
      const result = daterangeExtractor({ q: 'invalid' })
      assert.deepStrictEqual(result, [{ start: undefined, end: undefined }])
    })

    it('returns a range with empty q', () => {
      const result = daterangeExtractor({ q: '' })
      assert.deepStrictEqual(result, [{ start: undefined, end: undefined }])
    })
  })

  describe('floatRangeExtractor', () => {
    it('parses a "start TO end" float range string', () => {
      const result = floatRangeExtractor({ q: '0.1 TO 0.9' })
      assert.deepStrictEqual(result, [{ start: 0.1, end: 0.9 }])
    })

    it('parses a two-element array as float range', () => {
      const result = floatRangeExtractor({ q: ['0.2', '0.8'] })
      assert.deepStrictEqual(result, [{ start: 0.2, end: 0.8 }])
    })

    it('returns empty array when start or end is missing', () => {
      const result = floatRangeExtractor({ q: '' })
      assert.deepStrictEqual(result, [])
    })
  })

  describe('integerRangeExtractor', () => {
    it('parses a "start TO end" integer range string', () => {
      const result = integerRangeExtractor({ q: '1 TO 10' })
      assert.deepStrictEqual(result, [{ start: 1, end: 10 }])
    })

    it('parses a two-element array as integer range', () => {
      const result = integerRangeExtractor({ q: ['5', '15'] })
      assert.deepStrictEqual(result, [{ start: 5, end: 15 }])
    })

    it('returns empty array when q is empty', () => {
      const result = integerRangeExtractor({ q: '' })
      assert.deepStrictEqual(result, [])
    })
  })

  describe('simpleValueExtractor', () => {
    it('wraps a single string value', () => {
      const result = simpleValueExtractor({ q: 'abc' })
      assert.deepStrictEqual(result, [{ id: 'abc' }])
    })

    it('maps an array of strings', () => {
      const result = simpleValueExtractor({ q: ['abc', 'def'] })
      assert.deepStrictEqual(result, [{ id: 'abc' }, { id: 'def' }])
    })

    it('trims whitespace from values', () => {
      const result = simpleValueExtractor({ q: '  abc  ' })
      assert.deepStrictEqual(result, [{ id: 'abc' }])
    })

    it('returns empty array for empty string', () => {
      const result = simpleValueExtractor({ q: '' })
      assert.deepStrictEqual(result, [{ id: '' }])
    })
  })

  describe('newspaperExtractor', () => {
    it('resolves a single media source through a minimal app mock', async () => {
      const app = createMockAppWithMediaSources(mediaSourcesLookup)

      const result = await newspaperExtractor({ q: 'GDL' }, app)

      assert.strictEqual(result.length, 1)
      assert.deepStrictEqual(result[0], {
        id: 'GDL',
        name: 'Gazette de Lausanne',
        acronym: 'GDL',
        countArticles: 12,
        countIssues: 4,
        countPages: 48,
        deltaYear: 4,
        startYear: 1800,
        endYear: 1804,
        firstIssue: {
          uid: '',
          date: '1800-01-01',
          year: 1800,
        },
        lastIssue: {
          uid: '',
          date: '1804-12-31',
          year: 1804,
        },
        included: true,
        labels: [],
        languages: ['fr'],
        properties: [{ label: 'City', value: 'Lausanne', name: 'city' }],
      })
    })

    it('resolves multiple media sources from lookup-backed codes', async () => {
      const app = createMockAppWithMediaSources(mediaSourcesLookup)

      const result = await newspaperExtractor({ q: ['GDL', 'JDG'] }, app)

      assert.strictEqual(result.length, 2)
      assert.deepStrictEqual(
        result.map(item => item?.id),
        ['GDL', 'JDG']
      )
      assert.deepStrictEqual(
        result.map(item => item?.name),
        ['Gazette de Lausanne', 'Journal de Geneve']
      )
    })
  })
})
