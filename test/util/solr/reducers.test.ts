import assert from 'assert'
import { filtersToSolr, escapeValue, escapeIdValue, unescapeIdValue } from '../../../src/util/solr/filterReducers'
import { SolrNamespaces } from '../../../src/solr'
import { filtersToQueryAndVariables } from '../../../src/util/solr/index'
import { InvalidArgumentError } from '../../../src/util/error'
import { Filter } from '../../../src/models'

describe('filtersToSolr', () => {
  it('escapes parentheses', () => {
    const filter = {
      type: 'string',
      q: 'H. Allen Smith (represen',
    }
    const query = filtersToSolr([filter], SolrNamespaces.Entities)
    const expectedQuery =
      '(entitySuggest:H. AND entitySuggest:Allen AND entitySuggest:Smith AND entitySuggest:represen*)'
    assert.strictEqual(query, expectedQuery)
  })

  it('throws an error for an unknown filter type', () => {
    const filter = {
      type: 'booomooo',
      q: '',
    }
    assert.throws(
      () => filtersToSolr([filter], SolrNamespaces.Search),
      new InvalidArgumentError(`Unknown filter type "${filter.type}" in namespace "${SolrNamespaces.Search}"`)
    )
  })

  it('handles "minLengthOne" filter', () => {
    const filter = {
      type: 'hasTextContents',
    }
    const query = filtersToSolr([filter], SolrNamespaces.Search)
    assert.equal(query, 'content_length_i:[1 TO *]')
  })

  describe('handles "numericRange" filter', () => {
    it('with string', () => {
      const filter = {
        q: '1 TO 10',
        type: 'ocrQuality',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'ocrqa_f:[1 TO 10]')
    })

    it('with array', () => {
      const filter = {
        q: ['2', '20'],
        type: 'ocrQuality',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'ocrqa_f:[2 TO 20]')
    })

    it('throws an error with malformed string', () => {
      const filter = {
        q: 'foo bar',
        type: 'ocrQuality',
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search),
        new InvalidArgumentError(`"numericRange" filter rule: unknown value encountered in "q": ${filter.q}`)
      )
    })

    it('with no value', () => {
      const filter = {
        type: 'ocrQuality',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'ocrqa_f:*')
    })

    it('with empty array', () => {
      const filter = {
        q: [],
        type: 'ocrQuality',
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search),
        new InvalidArgumentError(`"numericRange" filter rule: unknown values encountered in "q": ${filter.q}`)
      )
    })
  })

  it('handles "boolean" filter', () => {
    const filter = {
      type: 'isFront',
    }
    const query = filtersToSolr([filter], SolrNamespaces.Search)
    assert.equal(query, 'front_b:1')
  })

  describe('handles "string" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'moo',
        type: 'title',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(title_txt_en:moo OR title_txt_fr:moo OR title_txt_de:moo)')
    })

    it('with array', () => {
      const filter = {
        q: ['foo'],
        type: 'title',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(title_txt_en:foo OR title_txt_fr:foo OR title_txt_de:foo)')
    })

    it('with text context exact by quotes', () => {
      /** @type {import('../../../src/models').Filter} */
      const filter = {
        type: 'string',
        context: 'include',
        q: '"ministre portugais"',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(
        query,
        '(content_txt_en:"ministre portugais" OR content_txt_fr:"ministre portugais" OR content_txt_de:"ministre portugais")'
      )
    })

    it('with text context escaped wrong quotes', () => {
      /** @type {import('../../../src/models').Filter} */
      const filter = {
        type: 'string',
        context: 'include',
        q: '"ministre "portugais"',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(
        query,
        '(content_txt_en:"ministre \\"portugais" OR content_txt_fr:"ministre \\"portugais" OR content_txt_de:"ministre \\"portugais")'
      )
    })

    it('with text context with multiple content', () => {
      /** @type {import('../../../src/models').Filter} */
      const filter = {
        type: 'string',
        context: 'include',
        q: ['"ministre portugais"', '"ministre italien"'],
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(
        query,
        // eslint-ignore-next-line
        '((content_txt_en:"ministre portugais" OR content_txt_fr:"ministre portugais" OR content_txt_de:"ministre portugais") OR (content_txt_en:"ministre italien" OR content_txt_fr:"ministre italien" OR content_txt_de:"ministre italien"))'
      )
    })

    it('with no value', () => {
      const filter = {
        type: 'title',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(title_txt_en:* OR title_txt_fr:* OR title_txt_de:*)')
    })

    it('with empty string', () => {
      const filter = {
        type: 'title',
        q: '',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(title_txt_en:* OR title_txt_fr:* OR title_txt_de:*)')
    })

    it('with empty array', () => {
      /** @type {import('../../../src/models').Filter} */
      const filter = {
        type: 'title',
        op: 'OR',
        q: [],
        precision: 'exact',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(title_txt_en:* OR title_txt_fr:* OR title_txt_de:*)')
    })

    it('with array of empty strings', () => {
      /** @type {import('../../../src/models').Filter} */
      const filter = {
        type: 'title',
        op: 'OR',
        q: ['', ''],
        precision: 'exact',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(title_txt_en:* OR title_txt_fr:* OR title_txt_de:*)')
    })
  })

  describe('handles "dateRange" filter', () => {
    it('with string', () => {
      const filter = {
        q: '1918 TO 2018',
        type: 'daterange',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'meta_date_dt:[1918 TO 2018]')
    })

    it('with ISO dates string', () => {
      const filter = {
        q: '1857-01-01T00:00:00Z TO 2014-12-31T23:59:59',
        type: 'daterange',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'meta_date_dt:[1857-01-01T00:00:00Z TO 2014-12-31T23:59:59]')
    })

    it('with ISO dates string in array', () => {
      const filter = {
        q: ['1857-01-01T00:00:00Z TO 2014-12-31T23:59:59'],
        type: 'daterange',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'meta_date_dt:[1857-01-01T00:00:00Z TO 2014-12-31T23:59:59]')
    })

    it('with array', () => {
      const filter = {
        q: ['1918', '2018'],
        type: 'daterange',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(meta_date_dt:[1918] OR meta_date_dt:[2018])')
    })

    it('with no value', () => {
      const filter = {
        type: 'daterange',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'meta_date_dt:*')
    })

    it('throws an error with malformed string', () => {
      const filter = {
        q: 'foo bar',
        type: 'daterange',
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search),
        new InvalidArgumentError(`"dateRange" filter rule: unknown value encountered in "q": ${filter.q}`)
      )
    })

    it('throws an error with empty array', () => {
      const filter = {
        q: [],
        type: 'daterange',
      }
      assert.throws(
        () => filtersToSolr([filter], SolrNamespaces.Search),
        new InvalidArgumentError(`"dateRange" filter rule: unknown values encountered in "q": ${filter.q}`)
      )
    })
  })

  describe('handles "value" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'en',
        type: 'language',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'lg_s:en')
    })

    it('with no value', () => {
      const filter = {
        type: 'language',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'lg_s:*')
    })

    it('with array', () => {
      const filter = {
        q: ['en', 'fr'],
        type: 'language',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(lg_s:en OR lg_s:fr)')
    })

    it('with multiple fields', () => {
      const filter = {
        q: ['ab', 'cd'],
        type: 'mention',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '((pers_mentions:ab OR loc_mentions:ab) OR (pers_mentions:cd OR loc_mentions:cd))')
    })

    it('with and/or fields', () => {
      const filter = {
        q: ['e-a', 'e-b'],
        type: 'entity',
        op: 'AND',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
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
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(pers_mentions:* OR loc_mentions:*)')
    })

    it('with empty string', () => {
      const filter = {
        type: 'language',
        q: '',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'lg_s:*')
    })

    it('negated single', () => {
      const filter = {
        type: 'language',
        q: 'en',
        context: 'exclude',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'NOT lg_s:en')
    })

    it('negated single OR', () => {
      const filter = {
        type: 'topic',
        q: 'tm-de-all-v2.0_tp23_de',
        context: 'exclude',
        op: 'OR',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'NOT topics_dpfs:tm-de-all-v2.0_tp23_de')
    })

    it('negated double', () => {
      const filter = {
        type: 'language',
        q: ['en', 'de'],
        context: 'exclude',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, 'NOT (lg_s:en OR lg_s:de)')
    })
  })

  describe('handles "regex" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'moo',
        type: 'regex',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(content_txt_en:/moo/ OR content_txt_fr:/moo/ OR content_txt_de:/moo/)')
    })

    it('with array', () => {
      const filter = {
        q: ['foo'],
        type: 'regex',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(content_txt_en:/foo/ OR content_txt_fr:/foo/ OR content_txt_de:/foo/)')
    })

    it('with no value', () => {
      const filter = {
        type: 'regex',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(content_txt_en:/.*/ OR content_txt_fr:/.*/ OR content_txt_de:/.*/)')
    })

    it('with empty string', () => {
      const filter = {
        type: 'regex',
        q: '',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(content_txt_en:/.*/ OR content_txt_fr:/.*/ OR content_txt_de:/.*/)')
    })

    it('with empty array', () => {
      const filter = {
        q: [],
        type: 'regex',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Search)
      assert.equal(query, '(content_txt_en:/.*/ OR content_txt_fr:/.*/ OR content_txt_de:/.*/)')
    })
  })

  describe('handles "capitalisedValue" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'person',
        type: 'type',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Entities)
      assert.equal(query, 't_s:Person')
    })

    it('with array', () => {
      const filter = {
        q: ['person', 'location'],
        type: 'type',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Entities)
      assert.equal(query, '(t_s:Person OR t_s:Location)')
    })

    it('with no value', () => {
      const filter = {
        type: 'type',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Entities)
      assert.equal(query, 't_s:*')
    })

    it('with empty array', () => {
      const filter = {
        q: [],
        type: 'type',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Entities)
      assert.equal(query, 't_s:*')
    })
  })

  describe('handles "openEndedString" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'Jacques Chira',
        type: 'string',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Entities)
      assert.equal(query, '(entitySuggest:Jacques AND entitySuggest:Chira*)')
    })
    it('with unigram', () => {
      const filter = {
        q: 'Jacques ',
        type: 'string',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Entities)
      assert.equal(query, 'entitySuggest:Jacques*')
    })
    it('with array', () => {
      const filter = {
        q: ['Jacques Chirac', 'Foo Bar'],
        type: 'string',
      }
      const query = filtersToSolr([filter], SolrNamespaces.Entities)
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
    const query = filtersToSolr([filter], SolrNamespaces.Search)
    const expectedQuery = 'pers_entities_dpfs:aida-0001-50-Poseidon_$28$film$29$'
    assert.strictEqual(query, expectedQuery)
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
      ]
      const result = filtersToQueryAndVariables(filters, SolrNamespaces.Search)
      assert.strictEqual(result.query, 'filter(meta_journal_s:SGZ) AND NOT filter(topics_dpfs:tm-de-all-v2.0_tp23_de)')
    })
  })
})

describe('escapeIdValue/unescapeIdValue', () => {
  it('escapes and unescapes', () => {
    const pairs = [
      ['aida-0001-50-Poseidon_(horse)', 'aida-0001-50-Poseidon_$28$horse$29$'],
      ['aida-0001-50-Van_Etten_(town),_New_York', 'aida-0001-50-Van_Etten_$28$town$29$$2c$_New_York'],
      ['aida-0001-50-Igor_Đurić_(Serbian_footballer)', 'aida-0001-50-Igor_Đurić_$28$Serbian_footballer$29$'],
    ]

    pairs.forEach(([original, escaped]) => {
      assert.strictEqual(escapeIdValue(original), escaped)
      assert.strictEqual(unescapeIdValue(escaped), original)
    })
  })
})
