import assert from 'assert'
import { buildPythonFunctionCall } from '@/logic/filters/impressoPy.js'
import { Filter } from 'impresso-jscommons'

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
    filters: Filter[]
    expectedResult: string
  }

  const testCases: TestCase[] = [
    {
      name: 'empty filters array',
      resource: 'search',
      functionName: 'find',
      filters: [],
      expectedResult: 'impresso.search.find()',
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
      expectedResult: 'impresso.search.find(\n\tterm="test"\n)',
    },
    {
      name: 'single string filter with OR operator',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'OR',
        },
      ],
      expectedResult: 'impresso.search.find(\n\tterm="test"\n)',
    },
    {
      name: 'string filter with array value',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: ['test1', 'test2'],
          op: 'AND',
        },
      ],
      expectedResult: 'impresso.search.find(\n\tterm=AND(["test1","test2"])\n)',
    },
    {
      name: 'string filter with array value and a term',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: ['test1', 'test2'],
          op: 'OR',
        },
        {
          type: 'string',
          q: 'test3',
          op: 'OR',
        },
      ],
      expectedResult: 'impresso.search.find(\n\tterm=AND([OR(["test1","test2"]),"test3"])\n)',
    },
    {
      name: 'filter with precision',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'AND',
          precision: 'fuzzy',
        },
      ],
      expectedResult: 'impresso.search.find(\n\tterm=Fuzzy("test")\n)',
    },
    {
      name: 'filter with context exclude',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'AND',
          context: 'exclude',
        },
      ],
      expectedResult: 'impresso.search.find(\n\tterm=~AND("test")\n)',
    },
    {
      name: 'filter with context include',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'AND',
          context: 'include',
        },
      ],
      expectedResult: 'impresso.search.find(\n\tterm="test"\n)',
    },
    {
      name: 'filter with precision and context',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'string',
          q: 'test',
          op: 'AND',
          precision: 'fuzzy',
          context: 'exclude',
        },
      ],
      expectedResult: 'impresso.search.find(\n\tterm=~Fuzzy("test")\n)',
    },
    {
      name: 'multiple filters',
      resource: 'content_items',
      functionName: 'facet',
      filters: [
        {
          type: 'newspaper',
          q: 'gazette',
          op: 'AND',
        },
        {
          type: 'daterange',
          q: ['1900-01-01', '1950-12-31'],
          op: 'AND',
        },
      ],
      expectedResult:
        'impresso.content_items.facet(\n\tnewspaper_id="gazette",\n\tdate_range=DateRange("1900-01-01", "1950-12-31")\n)',
    },
    {
      name: 'ignore filters with unsupported types',
      resource: 'entities',
      functionName: 'find',
      filters: [
        {
          type: 'newspaper',
          q: 'gazette',
          op: 'AND',
        },
        {
          type: 'copyright', // This has an empty argument name in the mapping
          q: 'some-value',
          op: 'AND',
        },
      ],
      expectedResult: 'impresso.entities.find(\n\tnewspaper_id="gazette"\n)',
    },
    {
      name: 'filters with undefined q value should be ignored',
      resource: 'collections',
      functionName: 'find',
      filters: [
        {
          type: 'newspaper',
          q: 'gazette',
          op: 'AND',
        },
        {
          type: 'language',
          q: undefined,
          op: 'AND',
        },
      ],
      expectedResult: 'impresso.collections.find(\n\tnewspaper_id="gazette"\n)',
    },
    {
      name: 'daterange filter with TO',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'daterange',
          q: '1912-01-01T00:00:00Z TO 1942-10-31T23:59:59Z',
          op: 'AND',
        },
      ],
      expectedResult:
        'impresso.search.find(\n\tdate_range=DateRange("1912-01-01T00:00:00Z", "1942-10-31T23:59:59Z")\n)',
    },
    {
      name: 'numeric filter',
      resource: 'search',
      functionName: 'find',
      filters: [
        {
          type: 'textReuseClusterSize',
          q: ['1', '3'],
        },
      ],
      expectedResult: 'impresso.search.find(\n\tcluster_size=(1, 3)\n)',
    },
  ]

  testCases.forEach(tc => {
    it(tc.name, () => {
      const result = buildPythonFunctionCall(tc.resource, tc.functionName, tc.filters)
      assert.equal(result, tc.expectedResult)
    })
  })
})
