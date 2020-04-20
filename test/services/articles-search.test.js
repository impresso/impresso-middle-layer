// @ts-check
const assert = require('assert');
const {
  relevanceContextItemToSolrFormula,
  RelevanceContextItemTypes,
} = require('../../src/services/articles-search/logic');

/**
 * @typedef {import('../../src/services/articles-search').RelevanceContextItem} RelevanceContextItem
 */

describe('logic', () => {
  describe('relevanceContextItemToSolrFormula', () => {
    it('creates correct formula for "timeRange" relevance context', () => {
      const testContext = {
        type: RelevanceContextItemTypes.TimeRange,
        weight: 2.3,
        parameters: {
          startYear: '1850',
          endYear: '1901',
        },
      };
      const expectedFormula = `
        mul(
          if(
            and(
              lte(meta_year_i,1901),
              gte(meta_year_i,1850)
            ),
            1.0,
            0.0
          ),
          2.3
        )`.replace(/[\s\n]/g, '');

      const formula = relevanceContextItemToSolrFormula(testContext);
      assert.equal(formula, expectedFormula);
    });
  });
});
