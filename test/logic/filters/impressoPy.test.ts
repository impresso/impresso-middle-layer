import assert from 'assert'
import { buildPythonFunctionCall } from '../../../src/logic/filters/impressoPy'

describe('buildPythonFunctionCall', () => {
  interface TestCase {
    name: string
    resource:
      | 'search'
      | 'media_sources'
      | 'entities'
      | 'content_items'
      | 'collections'
      | 'text_reuse.clusters'
      | 'text_reuse.passages'
    functionName: 'find' | 'facet'
    filters: any[]
    expectedResult: string
  }

  const testCases: TestCase[] = [
    {
      name: 'empty filters array',
      resource: 'search',
      functionName: 'find',
      filters: [],
      expectedResult: 'search.find()',
    },
    {
      name: 'single string filter with default operator',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
        },
      ],
      expectedResult: 'search.find(term=AND("test"))',
    },
    {
      name: 'single string filter with OR operator',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'or',
        },
      ],
      expectedResult: 'search.find(term=OR("test"))',
    },
    {
      name: 'string filter with array value',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: ['test1', 'test2'],
          op: 'and',
        },
      ],
      expectedResult: 'search.find(term=AND(["test1","test2"]))',
    },
    {
      name: 'filter with precision',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'and',
          precision: 'fuzzy',
        },
      ],
      expectedResult: 'search.find(term=Fuzzy(AND("test")))',
    },
    {
      name: 'filter with context exclude',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'and',
          context: 'exclude',
        },
      ],
      expectedResult: 'search.find(term=~AND("test"))',
    },
    {
      name: 'filter with context include',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'and',
          context: 'include',
        },
      ],
      expectedResult: 'search.find(term=AND("test"))',
    },
    {
      name: 'filter with precision and context',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'and',
          precision: 'fuzzy',
          context: 'exclude',
        },
      ],
      expectedResult: 'search.find(term=~Fuzzy(AND("test")))',
    },
    {
      name: 'multiple filters',
      resource: 'content_items',
      functionName: 'facet',
      filters: [
        {
          type: 'newspaper',
          q: 'gazette',
          op: 'and',
        },
        {
          type: 'daterange',
          q: ['1900-01-01', '1950-12-31'],
          op: 'and',
        },
      ],
      expectedResult: 'content_items.facet(newspaper_id=AND("gazette"), date_range=AND(["1900-01-01","1950-12-31"]))',
    },
    {
      name: 'ignore filters with unsupported types',
      resource: 'entities',
      functionName: 'find',
      filters: [
        {
          type: 'newspaper',
          q: 'gazette',
          op: 'and',
        },
        {
          type: 'copyright', // This has an empty argument name in the mapping
          q: 'some-value',
          op: 'and',
        },
      ],
      expectedResult: 'entities.find(newspaper_id=AND("gazette"))',
    },
    {
      name: 'filters with undefined q value should be ignored',
      resource: 'collections',
      functionName: 'find',
      filters: [
        {
          type: 'newspaper',
          q: 'gazette',
          op: 'and',
        },
        {
          type: 'language',
          q: undefined,
          op: 'and',
        },
      ],
      expectedResult: 'collections.find(newspaper_id=AND("gazette"))',
    },
  ]

  testCases.forEach(tc => {
    it(tc.name, () => {
      const result = buildPythonFunctionCall(tc.resource, tc.functionName, tc.filters)
      assert.equal(result, tc.expectedResult)
    })
  })
})
