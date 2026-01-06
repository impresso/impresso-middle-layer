import assert from 'assert'
import { buildPythonFunctionCall } from '@/logic/filters/impressoPy'
describe('buildPythonFunctionCall', () => {
  const testCases = [
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wcmVzc29QeS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaW1wcmVzc29QeS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQTtBQUMzQixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQTtBQUdsRixRQUFRLENBQUMseUJBQXlCLEVBQUUsR0FBRyxFQUFFO0lBZ0J2QyxNQUFNLFNBQVMsR0FBZTtRQUM1QjtZQUNFLElBQUksRUFBRSxxQkFBcUI7WUFDM0IsUUFBUSxFQUFFLFFBQVE7WUFDbEIsWUFBWSxFQUFFLE1BQU07WUFDcEIsT0FBTyxFQUFFLEVBQUU7WUFDWCxjQUFjLEVBQUUsd0JBQXdCO1NBQ3pDO1FBQ0Q7WUFDRSxJQUFJLEVBQUUsNENBQTRDO1lBQ2xELFFBQVEsRUFBRSxRQUFRO1lBQ2xCLFlBQVksRUFBRSxNQUFNO1lBQ3BCLE9BQU8sRUFBRTtnQkFDUDtvQkFDRSxJQUFJLEVBQUUsUUFBUTtvQkFDZCxDQUFDLEVBQUUsTUFBTTtpQkFDVjthQUNGO1lBQ0QsY0FBYyxFQUFFLHlDQUF5QztTQUMxRDtRQUNEO1lBQ0UsSUFBSSxFQUFFLHVDQUF1QztZQUM3QyxRQUFRLEVBQUUsUUFBUTtZQUNsQixZQUFZLEVBQUUsTUFBTTtZQUNwQixPQUFPLEVBQUU7Z0JBQ1A7b0JBQ0UsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsQ0FBQyxFQUFFLE1BQU07b0JBQ1QsRUFBRSxFQUFFLElBQUk7aUJBQ1Q7YUFDRjtZQUNELGNBQWMsRUFBRSx5Q0FBeUM7U0FDMUQ7UUFDRDtZQUNFLElBQUksRUFBRSxnQ0FBZ0M7WUFDdEMsUUFBUSxFQUFFLFFBQVE7WUFDbEIsWUFBWSxFQUFFLE1BQU07WUFDcEIsT0FBTyxFQUFFO2dCQUNQO29CQUNFLElBQUksRUFBRSxRQUFRO29CQUNkLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUM7b0JBQ3JCLEVBQUUsRUFB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
