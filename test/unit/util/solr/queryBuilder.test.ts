import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'
import { Filter } from '@/models/index.js'
import { SolrNamespace } from '@/solr.js'
import { InvalidArgumentError } from '@/util/error.js'
import {
  buildSolrQuery,
  BuildSolrQueryOptions,
  queryNodeToString,
  SolrJsonQueryBody,
  SolrQueryNode,
} from '@/util/solr/queryBuilder.js'

/**
 * Parametrised tests for `buildSolrQuery`, driven by `queryBuilder.cases.yml`.
 *
 * The cases are translated from the legacy string-based tests of the
 * deprecated `filtersToSolr` builder (see reducers.test.ts) to the Solr JSON
 * Query DSL. See the header of the cases file for translation notes and known
 * behaviour changes.
 */

interface TestCase {
  group: string
  name: string
  namespace: SolrNamespace
  filters: Filter[]
  solrNamespaces?: { namespaceId: string; index: string; serverId: string }[]
  features?: Record<string, unknown>
  options?: BuildSolrQueryOptions
  expected?: SolrJsonQueryBody
  expectedError?: string
}

const casesPath = join(dirname(fileURLToPath(import.meta.url)), 'queryBuilder.cases.yml')
const cases = (YAML.parse(readFileSync(casesPath, 'utf8')) as { cases: TestCase[] }).cases

const casesByGroup = new Map<string, TestCase[]>()
for (const testCase of cases) {
  const groupCases = casesByGroup.get(testCase.group) ?? []
  groupCases.push(testCase)
  casesByGroup.set(testCase.group, groupCases)
}

describe('queryNodeToString', () => {
  const cases: { name: string; node: SolrQueryNode; expected?: string; expectedError?: string }[] = [
    { name: 'string node passes through', node: 'lg_s:en', expected: 'lg_s:en' },
    { name: 'variable reference passes through', node: '$v0', expected: '$v0' },
    {
      name: 'bool must',
      node: { bool: { must: ['a:1', 'b:2'] } },
      expected: '(a:1 AND b:2)',
    },
    {
      name: 'bool should',
      node: { bool: { should: ['a:1', 'b:2'], minimum_should_match: 1 } },
      expected: '(a:1 OR b:2)',
    },
    {
      name: 'bool must_not (negation)',
      node: { bool: { must: ['*:*'], must_not: ['lg_s:en'] } },
      expected: '(*:* AND NOT lg_s:en)',
    },
    {
      name: 'single clause bool is not wrapped',
      node: { bool: { must: ['a:1'] } },
      expected: 'a:1',
    },
    {
      name: 'nested bool nodes preserve precedence',
      node: {
        bool: {
          must: [
            { bool: { should: ['a:1', 'a:2'], minimum_should_match: 1 } },
            { bool: { should: ['b:1', 'b:2'], minimum_should_match: 1 } },
          ],
        },
      },
      expected: '((a:1 OR a:2) AND (b:1 OR b:2))',
    },
    {
      name: 'join node',
      node: {
        join: {
          from: 'ci_id_s',
          to: 'id',
          fromIndex: 'collection-items',
          method: 'crossCollection',
          query: 'col_id_s:*_col-123',
        },
      },
      expected: '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}col_id_s:*_col-123',
    },
    {
      name: 'join node (new index)',
      node: {
        join: {
          from: 'ci_id_s',
          to: 'id',
          fromIndex: 'collection-items',
          method: 'index',
          query: 'col_id_s:*_col-123',
        },
      },
      expected: '{!join from=ci_id_s to=id fromIndex=collection-items method=index}col_id_s:*_col-123',
    },
    {
      name: 'knn node',
      node: { knn: { f: 'gte_multi_v768', topK: 10, query: '[1,2,3]' } },
      expected: '{!knn f=gte_multi_v768 topK=10}[1,2,3]',
    },
    {
      name: 'throws for empty bool node',
      node: { bool: {} },
      expectedError: 'Cannot serialise an empty bool query node to a query string',
    },
    {
      name: 'throws for minimum_should_match > 1',
      node: { bool: { should: ['a:1', 'b:2'], minimum_should_match: 2 } },
      expectedError: 'Cannot serialise a bool query node with minimum_should_match > 1 to a query string',
    },
  ]

  for (const { name, node, expected, expectedError } of cases) {
    it(name, () => {
      if (expectedError != null) {
        assert.throws(() => queryNodeToString(node), new InvalidArgumentError(expectedError))
      } else {
        assert.strictEqual(queryNodeToString(node), expected)
      }
    })
  }
})

describe('buildSolrQuery (cases from queryBuilder.cases.yml)', () => {
  for (const [group, groupCases] of casesByGroup) {
    describe(group, () => {
      for (const testCase of groupCases) {
        it(testCase.name, () => {
          const build = () =>
            buildSolrQuery(
              testCase.filters,
              testCase.namespace,
              (testCase.solrNamespaces ?? []) as never,
              (testCase.features ?? {}) as never,
              testCase.options ?? {}
            )

          if (testCase.expectedError != null) {
            assert.throws(build, (error: unknown) => {
              assert.ok(error instanceof InvalidArgumentError, `expected InvalidArgumentError, got: ${error}`)
              assert.strictEqual((error as Error).message, testCase.expectedError)
              return true
            })
          } else {
            assert.deepStrictEqual(build(), testCase.expected)
          }
        })
      }
    })
  }
})
