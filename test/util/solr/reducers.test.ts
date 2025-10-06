import assert from 'assert'
import { filtersToSolr, escapeValue, escapeIdValue, unescapeIdValue } from '../../../src/util/solr/filterReducers'
import { SolrNamespaces } from '../../../src/solr'
import { filtersToQueryAndVariables } from '../../../src/util/solr/index'
import { InvalidArgumentError } from '../../../src/util/error'
import { Filter, FilterContext, FilterOperator } from '../../../src/models'

describe('filtersToSolr', () => {
  it('escapes parentheses', () => {
    const filter = {
      type: 'string',
      q: 'H. Allen Smith (represen',
    } satisfies Filter
    const { query } = filtersToSolr([filter], SolrNamespaces.Entities, [])
    const expectedQuery =
      '(entitySuggest:H. AND entitySuggest:Allen AND entitySuggest:Smith AND entitySuggest:represen*)'
    assert.strictEqual(query, expectedQuery)
  })

  it('throws an error for an unknown filter type', () => {
    const filter = {
      type: 'booomooo',
      q: '',
    } satisfies Filter
    assert.throws(
      () => filtersToSolr([filter], SolrNamespaces.Search, []),
      new InvalidArgumentError(`Unknown filter type "${filter.type}" in namespace "${SolrNamespaces.Search}"`)
    )
  })

  it('handles "minLengthOne" filter', () => {
    const filter = {
      type: 'hasTextContents',
    } satisfies Filter
    const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
    assert.equal(query, 'content_length_i:[1 TO *]')
  })

  describe('handles "numericRange" filter', () => {
    it('with string', () => {
      const filter = {
        q: '1 TO 10',
        type: 'ocrQuality',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'ocrqa_f:[1 TO 10]')
    })

    it('with array', () => {
      const filter = {
        q: ['2', '20'],
        type: 'ocrQuality',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'ocrqa_f:[2 TO 20]')
    })

    it('throws an error with malformed string', () => {
      const filter = {
        q: 'foo bar',
        type: 'ocrQuality',
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, []),
        new InvalidArgumentError(`"numericRange" filter rule: unknown value encountered in "q": ${filter.q}`)
      )
    })

    it('with no value', () => {
      const filter = {
        type: 'ocrQuality',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'ocrqa_f:*')
    })

    it('with empty array', () => {
      const filter = {
        q: [],
        type: 'ocrQuality',
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, []),
        new InvalidArgumentError(`"numericRange" filter rule: unknown values encountered in "q": ${filter.q}`)
      )
    })
  })

  it('handles "boolean" filter', () => {
    const filter = {
      type: 'isFront',
    }
    const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
    assert.equal(query, 'front_b:1')
  })

  describe('handles "string" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'moo',
        type: 'title',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(title_txt_fr:moo OR title_txt_de:moo OR title_txt_en:moo OR title_txt_it:moo OR title_txt_es:moo OR title_txt_nl:moo OR title_txt:moo)'
      )
    })

    it('with array', () => {
      const filter = {
        q: ['foo'],
        type: 'title',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(title_txt_fr:foo OR title_txt_de:foo OR title_txt_en:foo OR title_txt_it:foo OR title_txt_es:foo OR title_txt_nl:foo OR title_txt:foo)'
      )
    })

    it('with text context exact by quotes', () => {
      const filter = {
        type: 'string',
        context: 'include',
        q: '"ministre portugais"',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(content_txt_fr:"ministre portugais" OR content_txt_de:"ministre portugais" OR content_txt_en:"ministre portugais" OR content_txt_it:"ministre portugais" OR content_txt_es:"ministre portugais" OR content_txt_nl:"ministre portugais" OR content_txt:"ministre portugais")'
      )
    })

    it('with text context escaped wrong quotes', () => {
      const filter = {
        type: 'string',
        context: 'include',
        q: '"ministre "portugais"',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        `(content_txt_fr:"ministre \\"portugais" OR content_txt_de:"ministre \\"portugais" OR content_txt_en:"ministre \\"portugais" OR content_txt_it:"ministre \\"portugais" OR content_txt_es:"ministre \\"portugais" OR content_txt_nl:"ministre \\"portugais" OR content_txt:"ministre \\"portugais")`
      )
    })

    it('with text context with multiple content', () => {
      const filter = {
        type: 'string',
        context: 'include',
        q: ['"ministre portugais"', '"ministre italien"'],
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        // eslint-ignore-next-line
        '((content_txt_fr:"ministre portugais" OR content_txt_de:"ministre portugais" OR content_txt_en:"ministre portugais" OR content_txt_it:"ministre portugais" OR content_txt_es:"ministre portugais" OR content_txt_nl:"ministre portugais" OR content_txt:"ministre portugais") OR (content_txt_fr:"ministre italien" OR content_txt_de:"ministre italien" OR content_txt_en:"ministre italien" OR content_txt_it:"ministre italien" OR content_txt_es:"ministre italien" OR content_txt_nl:"ministre italien" OR content_txt:"ministre italien"))'
      )
    })

    it('with no value', () => {
      const filter = {
        type: 'title',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(title_txt_fr:* OR title_txt_de:* OR title_txt_en:* OR title_txt_it:* OR title_txt_es:* OR title_txt_nl:* OR title_txt:*)'
      )
    })

    it('with empty string', () => {
      const filter = {
        type: 'title',
        q: '',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(title_txt_fr:* OR title_txt_de:* OR title_txt_en:* OR title_txt_it:* OR title_txt_es:* OR title_txt_nl:* OR title_txt:*)'
      )
    })

    it('with empty array', () => {
      const filter = {
        type: 'title',
        op: 'OR',
        q: [],
        precision: 'exact',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(title_txt_fr:* OR title_txt_de:* OR title_txt_en:* OR title_txt_it:* OR title_txt_es:* OR title_txt_nl:* OR title_txt:*)'
      )
    })

    it('with array of empty strings', () => {
      const filter = {
        type: 'title',
        op: 'OR',
        q: ['', ''],
        precision: 'exact',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(title_txt_fr:* OR title_txt_de:* OR title_txt_en:* OR title_txt_it:* OR title_txt_es:* OR title_txt_nl:* OR title_txt:*)'
      )
    })
  })

  describe('handles "dateRange" filter', () => {
    it('with year string', () => {
      const filter = {
        q: '1918 TO 2018',
        type: 'daterange',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'meta_date_dt:[1918-01-01T00:00:00Z TO 2018-01-01T23:59:59Z]')
    })

    it('with yea-month string', () => {
      const filter = {
        q: '1918-02 TO 2018-03',
        type: 'daterange',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'meta_date_dt:[1918-02-01T00:00:00Z TO 2018-03-01T23:59:59Z]')
    })

    it('with ISO datetime string', () => {
      const filter = {
        q: '1857-01-01T00:00:00Z TO 2014-12-31T23:59:59',
        type: 'daterange',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'meta_date_dt:[1857-01-01T00:00:00Z TO 2014-12-31T23:59:59]')
    })

    it('with ISO date string', () => {
      const filter = {
        q: '1857-01-01 TO 2014-12-31',
        type: 'daterange',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'meta_date_dt:[1857-01-01T00:00:00Z TO 2014-12-31T23:59:59Z]')
    })

    it('with ISO dates string in array', () => {
      const filter = {
        q: ['1857-01-01T00:00:00Z TO 2014-12-31T23:59:59'],
        type: 'daterange',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'meta_date_dt:[1857-01-01T00:00:00Z TO 2014-12-31T23:59:59]')
    })

    it('with multiple ISO date strings in array', () => {
      const filter = {
        q: ['1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z', '1945-01-01T00:00:00Z TO 1946-01-01T00:00:00Z'],
        type: 'daterange',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T23:59:59Z] OR meta_date_dt:[1945-01-01T00:00:00Z TO 1946-01-01T23:59:59Z])'
      )
    })

    it('with array', () => {
      const filter = {
        q: ['1918', '2018'],
        type: 'daterange',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'meta_date_dt:[1918-01-01T00:00:00Z TO 2018-01-01T23:59:59Z]')
    })

    it('with no value', () => {
      const filter = {
        type: 'daterange',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'meta_date_dt:*')
    })

    it('throws an error with malformed string', () => {
      const filter = {
        q: 'foo bar',
        type: 'daterange',
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, []),
        new InvalidArgumentError(`"dateRange" filter rule: unknown value encountered in "q": ${filter.q}`)
      )
    })

    it('throws an error with empty array', () => {
      const filter = {
        q: [],
        type: 'daterange',
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, []),
        new InvalidArgumentError(`"dateRange" filter rule: array "q" must have exactly 2 elements: ${filter.q}`)
      )
    })
  })

  describe('handles "value" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'en',
        type: 'language',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'lg_s:en')
    })

    it('with no value', () => {
      const filter = {
        type: 'language',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'lg_s:*')
    })

    it('with array', () => {
      const filter = {
        q: ['en', 'fr'],
        type: 'language',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, '(lg_s:en OR lg_s:fr)')
    })

    it('with multiple fields', () => {
      const filter = {
        q: ['ab', 'cd'],
        type: 'mention',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, '((pers_mentions:ab OR loc_mentions:ab) OR (pers_mentions:cd OR loc_mentions:cd))')
    })

    it('with and/or fields', () => {
      const filter = {
        q: ['e-a', 'e-b'],
        type: 'entity',
        op: 'AND',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '((pers_entities_dpfs:e-a OR loc_entities_dpfs:e-a) AND (pers_entities_dpfs:e-b OR loc_entities_dpfs:e-b))'
      )
    })

    it('with empty array', () => {
      const filter = {
        q: [],
        type: 'mention',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, '(pers_mentions:* OR loc_mentions:*)')
    })

    it('with empty string', () => {
      const filter = {
        type: 'language',
        q: '',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'lg_s:*')
    })

    it('negated single', () => {
      const filter = {
        type: 'language',
        q: 'en',
        context: 'exclude',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'NOT lg_s:en')
    })

    it('negated single OR', () => {
      const filter = {
        type: 'topic',
        q: 'tm-de-all-v2.0_tp23_de',
        context: 'exclude',
        op: 'OR',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'NOT topics_dpfs:tm-de-all-v2.0_tp23_de')
    })

    it('negated double', () => {
      const filter = {
        type: 'language',
        q: ['en', 'de'],
        context: 'exclude',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(query, 'NOT (lg_s:en OR lg_s:de)')
    })
  })

  describe('handles "regex" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'moo',
        type: 'regex',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(content_txt_fr:/moo/ OR content_txt_de:/moo/ OR content_txt_en:/moo/ OR content_txt_it:/moo/ OR content_txt_es:/moo/ OR content_txt_nl:/moo/ OR content_txt:/moo/)'
      )
    })

    it('with array', () => {
      const filter = {
        q: ['foo'],
        type: 'regex',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(content_txt_fr:/foo/ OR content_txt_de:/foo/ OR content_txt_en:/foo/ OR content_txt_it:/foo/ OR content_txt_es:/foo/ OR content_txt_nl:/foo/ OR content_txt:/foo/)'
      )
    })

    it('with no value', () => {
      const filter = {
        type: 'regex',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(content_txt_fr:/.*/ OR content_txt_de:/.*/ OR content_txt_en:/.*/ OR content_txt_it:/.*/ OR content_txt_es:/.*/ OR content_txt_nl:/.*/ OR content_txt:/.*/)'
      )
    })

    it('with empty string', () => {
      const filter = {
        type: 'regex',
        q: '',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(content_txt_fr:/.*/ OR content_txt_de:/.*/ OR content_txt_en:/.*/ OR content_txt_it:/.*/ OR content_txt_es:/.*/ OR content_txt_nl:/.*/ OR content_txt:/.*/)'
      )
    })

    it('with empty array', () => {
      const filter = {
        q: [],
        type: 'regex',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
      assert.equal(
        query,
        '(content_txt_fr:/.*/ OR content_txt_de:/.*/ OR content_txt_en:/.*/ OR content_txt_it:/.*/ OR content_txt_es:/.*/ OR content_txt_nl:/.*/ OR content_txt:/.*/)'
      )
    })
  })

  // not used anywhere at the moment
  xdescribe('handles "capitalisedValue" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'person',
        type: 'type',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Entities, [])
      assert.equal(query, 't_s:Person')
    })

    it('with array', () => {
      const filter = {
        q: ['person', 'location'],
        type: 'type',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Entities, [])
      assert.equal(query, '(t_s:Person OR t_s:Location)')
    })

    it('with no value', () => {
      const filter = {
        type: 'type',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Entities, [])
      assert.equal(query, 't_s:*')
    })

    it('with empty array', () => {
      const filter = {
        q: [],
        type: 'type',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Entities, [])
      assert.equal(query, 't_s:*')
    })
  })

  describe('handles "openEndedString" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'Jacques Chira',
        type: 'string',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Entities, [])
      assert.equal(query, '(entitySuggest:Jacques AND entitySuggest:Chira*)')
    })
    it('with unigram', () => {
      const filter = {
        q: 'Jacques ',
        type: 'string',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Entities, [])
      assert.equal(query, 'entitySuggest:Jacques*')
    })
    it('with array', () => {
      const filter = {
        q: ['Jacques Chirac', 'Foo Bar'],
        type: 'string',
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Entities, [])
      assert.equal(
        query,
        '((entitySuggest:Jacques AND entitySuggest:Chirac*) OR (entitySuggest:Foo AND entitySuggest:Bar*))'
      )
    })
  })

  it('escapes IDs', () => {
    const filter: Filter = {
      type: 'person',
      q: 'aida-0001-50-Poseidon_(film)',
    }
    const { query } = filtersToSolr([filter], SolrNamespaces.Search, [])
    const expectedQuery = 'pers_entities_dpfs:aida-0001-50-Poseidon_$28$film$29$'
    assert.strictEqual(query, expectedQuery)
  })

  describe('handles "joinCollection" filter', () => {
    const mockSolrNamespaces = [
      {
        namespaceId: 'collection_items',
        index: 'collection-items',
        serverId: 'mock-server',
      },
    ]

    it('with single collection ID (include)', () => {
      const filter = {
        type: 'collection',
        q: 'col-123',
        context: 'include',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}col_id_s:*_col-123'
      )
    })

    it('with multiple collection IDs (include, OR)', () => {
      const filter = {
        type: 'collection',
        q: ['col-123', 'col-456'],
        context: 'include' as FilterContext,
        op: 'OR',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}col_id_s:*_col-123 OR col_id_s:*_col-456'
      )
    })

    it('with multiple collection IDs (include, AND)', () => {
      const filter = {
        type: 'collection',
        q: ['col-123', 'col-456'],
        context: 'include' as FilterContext,
        op: 'AND',
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}col_id_s:*_col-123 AND col_id_s:*_col-456'
      )
    })

    it('with single collection ID (exclude)', () => {
      const filter = {
        type: 'collection',
        q: 'col-123',
        context: 'exclude' as FilterContext,
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}NOT col_id_s:*_col-123'
      )
    })

    it('with multiple collection IDs (exclude, OR)', () => {
      const filter = {
        type: 'collection',
        q: ['col-123', 'col-456'],
        context: 'exclude' as FilterContext,
        op: 'OR' as FilterOperator,
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}NOT col_id_s:*_col-123 OR NOT col_id_s:*_col-456'
      )
    })

    it('with collection ID containing special characters', () => {
      const filter = {
        type: 'collection',
        q: 'col_(special)',
        context: 'include' as FilterContext,
      }
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}col_id_s:*_col_(special)'
      )
    })

    it('throws error when collection-items namespace not found', () => {
      const filter = {
        type: 'collection',
        q: 'col-123',
        context: 'include' as FilterContext,
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, []),
        new InvalidArgumentError(
          'Could not find Solr namespace configuration for "collection_items" required for "joinCollection" filter'
        )
      )
    })

    it('throws error when no collection IDs provided', () => {
      const filter = {
        type: 'collection',
        context: 'include' as FilterContext,
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces),
        new InvalidArgumentError('At least one collection ID must be provided for "joinCollection" filter')
      )
    })

    it('with mixed include and exclude filters', () => {
      const filters = [
        {
          type: 'collection',
          q: 'col-include',
          context: 'include' as FilterContext,
          op: 'AND' as FilterOperator,
        },
        {
          type: 'collection',
          q: 'col-exclude',
          context: 'exclude' as FilterContext,
          op: 'AND' as FilterOperator,
        },
      ]
      const { query } = filtersToSolr(filters, SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}col_id_s:*_col-include AND NOT col_id_s:*_col-exclude'
      )
    })

    it('with complex mixed AND/OR operations', () => {
      const filters = [
        {
          type: 'collection',
          q: ['col-and-1', 'col-and-2'],
          context: 'include' as FilterContext,
          op: 'AND' as FilterOperator,
        },
        {
          type: 'collection',
          q: ['col-or-1', 'col-or-2'],
          context: 'include' as FilterContext,
          op: 'OR' as FilterOperator,
        },
      ]
      const { query } = filtersToSolr(filters, SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        '{!join from=ci_id_s to=id fromIndex=collection-items method=crossCollection}(col_id_s:*_col-and-1 AND col_id_s:*_col-and-2) AND (col_id_s:*_col-or-1 OR col_id_s:*_col-or-2)'
      )
    })
  })

  describe('handles "embeddingKnnSimilarity" filter', () => {
    // Helper function to create a base64 encoded float32 vector
    const createTestVector = (values: number[]): string => {
      const floatArray = new Float32Array(values)
      const buffer = Buffer.from(floatArray.buffer)
      return buffer.toString('base64')
    }

    const mockSolrNamespaces = [
      {
        namespaceId: 'search',
        index: 'search-index',
        serverId: 'mock-server',
      },
      {
        namespaceId: 'images',
        index: 'images-index',
        serverId: 'mock-server',
      },
    ]

    it('with single embedding vector for search index', () => {
      const testVector = createTestVector([0.1, 0.2, 0.3, 0.4])
      const filter = {
        type: 'embedding',
        q: `gte-768:${testVector}`,
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        `{!knn f=gte_multi_v768 topK=10}[0.10000000149011612,0.20000000298023224,0.30000001192092896,0.4000000059604645]`
      )
    })

    it('with single embedding vector for images index', () => {
      const testVector = createTestVector([0.5, 0.6, 0.7, 0.8])
      const filter = {
        type: 'embedding',
        q: `openclip-768:${testVector}`,
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Images, mockSolrNamespaces)
      assert.equal(
        query,
        `{!knn f=openclip_emb_v768 topK=10}[0.5,0.6000000238418579,0.699999988079071,0.800000011920929]`
      )
    })

    it('with multiple embedding vectors from different models', () => {
      const testVector1 = createTestVector([0.1, 0.2])
      const testVector2 = createTestVector([0.9, 0.8])
      const filters = [
        {
          type: 'embedding',
          q: `openclip-768:${testVector1}`,
        },
        {
          type: 'embedding',
          q: `dinov2-1024:${testVector2}`,
        },
      ] satisfies Filter[]
      const { query } = filtersToSolr(filters, SolrNamespaces.Images, mockSolrNamespaces)
      assert.equal(
        query,
        `{!knn f=openclip_emb_v768 topK=10}[0.10000000149011612,0.20000000298023224] AND {!knn f=dinov2_emb_v1024 topK=10}[0.8999999761581421,0.800000011920929]`
      )
    })

    it('with embedding vector in array format', () => {
      const testVector = createTestVector([1.0, 2.0, 3.0])
      const filter = {
        type: 'embedding',
        q: [`gte-768:${testVector}`],
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(query, `{!knn f=gte_multi_v768 topK=10}[1,2,3]`)
    })

    it('throws error when q is not a string', () => {
      const filter = {
        type: 'embedding',
        q: 123,
      } as any // Intentionally invalid type for testing
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces),
        new InvalidArgumentError(
          '"embeddingKnnSimilarity" filter rule requires "q" to be a string in the format "model:base64_encoded_vector", e.g. "openclip-768:BASE64_ENCODED_VECTOR". Received: 123'
        )
      )
    })

    it('throws error when q does not contain colon separator', () => {
      const filter = {
        type: 'embedding',
        q: 'invalid-format',
      } satisfies Filter
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces),
        new InvalidArgumentError(
          '"embeddingKnnSimilarity" filter rule requires "q" to be a string in the format "model:base64_encoded_vector", e.g. "openclip-768:BASE64_ENCODED_VECTOR". Received: "invalid-format"'
        )
      )
    })

    it('throws error when model is not supported', () => {
      const testVector = createTestVector([0.1, 0.2])
      const filter = {
        type: 'embedding',
        q: `unsupported-model:${testVector}`,
      } satisfies Filter
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces),
        new InvalidArgumentError(
          '"embeddingKnnSimilarity" filter rule: unknown model "unsupported-model". Supported models: gte-768'
        )
      )
    })

    it('throws error when model is not supported in images index', () => {
      const testVector = createTestVector([0.1, 0.2])
      const filter = {
        type: 'embedding',
        q: `gte-768:${testVector}`,
      } satisfies Filter
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Images, mockSolrNamespaces),
        new InvalidArgumentError(
          '"embeddingKnnSimilarity" filter rule: unknown model "gte-768". Supported models: openclip-768, dinov2-1024'
        )
      )
    })

    it('with empty vector (single float)', () => {
      const testVector = createTestVector([0.0])
      const filter = {
        type: 'embedding',
        q: `gte-768:${testVector}`,
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(query, `{!knn f=gte_multi_v768 topK=10}[0]`)
    })

    it('with large vector', () => {
      // Create a vector with 10 dimensions for testing
      const largeVector = Array.from({ length: 10 }, (_, i) => i * 0.1)
      const testVector = createTestVector(largeVector)
      const filter = {
        type: 'embedding',
        q: `gte-768:${testVector}`,
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      const expectedVector = largeVector.map(v => {
        // Account for float32 precision
        const float32 = new Float32Array([v])[0]
        return float32
      })
      assert.equal(query, `{!knn f=gte_multi_v768 topK=10}${JSON.stringify(expectedVector)}`)
    })

    it('with negative values in vector', () => {
      const testVector = createTestVector([-0.5, -0.3, 0.2, 0.4])
      const filter = {
        type: 'embedding',
        q: `gte-768:${testVector}`,
      } satisfies Filter
      const { query } = filtersToSolr([filter], SolrNamespaces.Search, mockSolrNamespaces)
      assert.equal(
        query,
        `{!knn f=gte_multi_v768 topK=10}[-0.5,-0.30000001192092896,0.20000000298023224,0.4000000059604645]`
      )
    })
  })
})

describe('filtersToQueryAndVariables', () => {
  describe('handles compound filters', () => {
    it('two with one negation', () => {
      const filters = [
        { context: 'include', op: 'OR', type: 'newspaper', q: 'SGZ' },
        {
          context: 'exclude',
          op: 'OR',
          type: 'topic',
          q: 'tm-de-all-v2.0_tp23_de',
        },
      ] satisfies Filter[]
      const result = filtersToQueryAndVariables(filters, SolrNamespaces.Search, [])
      assert.strictEqual(result.query, 'NOT filter(topics_dpfs:tm-de-all-v2.0_tp23_de)')
      assert.deepEqual(result.filter, ['meta_journal_s:SGZ'])
    })
  })
})

describe('escapeIdValue/unescapeIdValue', () => {
  it('escapes and unescapes', () => {
    const pairs = [
      ['aida-0001-50-Poseidon_(horse)', 'aida-0001-50-Poseidon_$28$horse$29$'],
      ['aida-0001-50-Van_Etten_(town),_New_York', 'aida-0001-50-Van_Etten_$28$town$29$$2c$_New_York'],
      ['aida-0001-50-Igor_Đurić_(Serbian_footballer)', 'aida-0001-50-Igor_Đurić_$28$Serbian_footballer$29$'],
      ['aida-0001-50-Antônio_da_Silva_(footballer)', 'aida-0001-50-Antônio_da_Silva_$28$footballer$29$'],
    ]

    pairs.forEach(([original, escaped]) => {
      assert.strictEqual(escapeIdValue(original), escaped)
      assert.strictEqual(unescapeIdValue(escaped), original)
    })
  })
})
