const assert = require('assert');
const { SolrNamespaces } = require('../../../src/solr');
const { filtersToSolr } = require('../../../src/util/solr/filterReducers');

describe('filtersToSolr', () => {
  it('throws an error for an unknown filter type', () => {
    const filter = {
      type: 'booomooo',
    };
    assert.throws(
      () => filtersToSolr(filter.type, [filter], SolrNamespaces.Search),
      new Error(`Unknown filter type "${filter.type}" in namespace "${SolrNamespaces.Search}"`),
    );
  });

  it('handles "minLengthOne" filter', () => {
    const filter = {
      type: 'hasTextContents',
    };
    const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
    assert.equal(query, 'content_length_i:[1 TO *]');
  });

  describe('handles "numericRange" filter', () => {
    it('with string', () => {
      const filter = {
        q: '1 TO 10',
        type: 'ocrQuality',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, 'ocrqa_f:[1 TO 10]');
    });

    it('with array', () => {
      const filter = {
        q: ['2', '20'],
        type: 'ocrQuality',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, 'ocrqa_f:[2 TO 20]');
    });

    it('throws an error with malformed string', () => {
      const filter = {
        q: 'foo bar',
        type: 'ocrQuality',
      };
      assert.throws(
        () => filtersToSolr(filter.type, [filter], SolrNamespaces.Search),
        new Error(`"numericRange" filter rule: unknown value encountered in "q": ${filter.q}`),
      );
    });
  });

  it('handles "boolean" filter', () => {
    const filter = {
      type: 'isFront',
    };
    const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
    assert.equal(query, 'front_b:1');
  });

  describe('handles "string" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'moo',
        type: 'title',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(title_txt_en:moo OR title_txt_fr:moo OR title_txt_de:moo)');
    });

    it('with array', () => {
      const filter = {
        q: ['foo'],
        type: 'title',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(title_txt_en:foo OR title_txt_fr:foo OR title_txt_de:foo)');
    });

    it('with text context exact by quotes', () => {
      const filter = {
        type: 'string',
        context: 'include',
        q: '"ministre portugais"',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(content_txt_en:"ministre portugais" OR content_txt_fr:"ministre portugais" OR content_txt_de:"ministre portugais")');
    });

    it('with text context escaped wrong quotes', () => {
      const filter = {
        type: 'string',
        context: 'include',
        q: '"ministre "portugais"',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(content_txt_en:"ministre \\"portugais" OR content_txt_fr:"ministre \\"portugais" OR content_txt_de:"ministre \\"portugais")');
    });

    it('with text context with multiple content', () => {
      const filter = {
        type: 'string',
        context: 'include',
        q: ['"ministre portugais"', '"ministre italien"'],
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '((content_txt_en:"ministre portugais" OR content_txt_fr:"ministre portugais" OR content_txt_de:"ministre portugais") OR (content_txt_en:"ministre italien" OR content_txt_fr:"ministre italien" OR content_txt_de:"ministre italien"))');
    });
  });

  describe('handles "dateRange" filter', () => {
    it('with string', () => {
      const filter = {
        q: '1918 TO 2018',
        type: 'daterange',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, 'meta_date_dt:[1918 TO 2018]');
    });

    it('with array', () => {
      const filter = {
        q: ['1918', '2018'],
        type: 'daterange',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(meta_date_dt:[1918] OR meta_date_dt:[2018])');
    });

    it('throws an error with malformed string', () => {
      const filter = {
        q: 'foo bar',
        type: 'daterange',
      };
      assert.throws(
        () => filtersToSolr(filter.type, [filter], SolrNamespaces.Search),
        new Error(`"dateRange" filter rule: unknown value encountered in "q": ${filter.q}`),
      );
    });
  });

  describe('handles "value" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'en',
        type: 'language',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, 'lg_s:en');
    });

    it('with array', () => {
      const filter = {
        q: ['en', 'fr'],
        type: 'language',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(lg_s:en OR lg_s:fr)');
    });

    it('with multiple fields', () => {
      const filter = {
        q: ['ab', 'cd'],
        type: 'mention',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(pers_mentions:ab OR loc_mentions:ab OR pers_mentions:cd OR loc_mentions:cd)');
    });
  });

  describe('handles "regex" filter', () => {
    it('with string', () => {
      const filter = {
        q: 'moo',
        type: 'regex',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(content_txt_en:/moo/ OR content_txt_fr:/moo/ OR content_txt_de:/moo/)');
    });

    it('with array', () => {
      const filter = {
        q: ['foo'],
        type: 'regex',
      };
      const query = filtersToSolr(filter.type, [filter], SolrNamespaces.Search);
      assert.equal(query, '(content_txt_en:/foo/ OR content_txt_fr:/foo/ OR content_txt_de:/foo/)');
    });
  });
});
