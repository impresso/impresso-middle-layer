const assert = require('assert');
const {
  relevanceContextItemToSolrFormula,
  RelevanceContextItemTypes,
} = require('../../src/services/articles-search/logic');

/**
 * @typedef {import('../../src/services/articles-search').RelevanceContextItem} RelevanceContextItem
 * @typedef {import('../../src/services/articles-search').RelevanceContextItemType} Type
 */

describe('logic', () => {
  describe('relevanceContextItemToSolrFormula', () => {
    describe('"timeRange" relevance context', () => {
      it('creates correct formula with both years', () => {
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
      it('creates correct formula with start year', () => {
        const testContext = {
          type: RelevanceContextItemTypes.TimeRange,
          weight: 2.3,
          parameters: {
            startYear: '1850',
          },
        };
        const expectedFormula = `
          mul(
            if(
              gte(meta_year_i,1850),
              1.0,
              0.0
            ),
            2.3
          )`.replace(/[\s\n]/g, '');

        const formula = relevanceContextItemToSolrFormula(testContext);
        assert.equal(formula, expectedFormula);
      });
      it('creates correct formula with no years', () => {
        const testContext = {
          type: RelevanceContextItemTypes.TimeRange,
          weight: 2.3,
          parameters: {},
        };
        const expectedFormula = `
          mul(
            1.0,
            2.3
          )`.replace(/[\s\n]/g, '');

        const formula = relevanceContextItemToSolrFormula(testContext);
        assert.equal(formula, expectedFormula);
      });
    });

    [
      [RelevanceContextItemTypes.Locations, 'loc_entities_dpfs'],
      [RelevanceContextItemTypes.Persons, 'pers_entities_dpfs'],
      [RelevanceContextItemTypes.Topics, 'topics_dpfs'],
    ].forEach(([_type, solrField]) => {
      const type = /** @type {Type} */ (_type);

      describe(`"${type}" relevance context`, () => {
        it('creates correct formula with 2 items', () => {
          const testContext = {
            type,
            weight: 1.3,
            parameters: {
              entities: [
                { id: 'id-a', weight: 2.5 },
                { id: 'id-b', weight: 0.2 },
              ],
            },
          };
          const expectedFormula = `
            mul(
              sum(
                mul(
                  payload(${solrField},id-a),
                  2.5
                ),
                mul(
                  payload(${solrField},id-b),
                  0.2
                )
              ),
              1.3
            )`.replace(/[\s\n]/g, '');

          const formula = relevanceContextItemToSolrFormula(testContext);
          assert.equal(formula, expectedFormula);
        });
        it('creates correct formula with 1 item', () => {
          const testContext = {
            type,
            weight: 1.3,
            parameters: {
              entities: [
                { id: 'id-a', weight: 2.5 },
              ],
            },
          };
          const expectedFormula = `
            mul(
              mul(
                payload(${solrField},id-a),
                2.5
              ),
              1.3
            )`.replace(/[\s\n]/g, '');

          const formula = relevanceContextItemToSolrFormula(testContext);
          assert.equal(formula, expectedFormula);
        });
        it('creates correct formula with 0 items', () => {
          const testContext = {
            type,
            weight: 1.3,
            parameters: {
              entities: [],
            },
          };
          const expectedFormula = `
            mul(
              1.0,
              1.3
            )`.replace(/[\s\n]/g, '');

          const formula = relevanceContextItemToSolrFormula(testContext);
          assert.equal(formula, expectedFormula);
        });
      });
    });
  });

  describe('"textReuseClusters" relevance context', () => {
    it('creates correct formula with 2 items', () => {
      const testContext = {
        type: RelevanceContextItemTypes.TextReuseClusters,
        weight: 1.3,
        parameters: {
          entities: [
            { id: 'id-a', weight: 2.5 },
            { id: 'id-b', weight: 0.2 },
          ],
        },
      };
      const expectedFormula = `
        mul(
          sum(
            mul(
              exists(query({!df=cluster_id_ss v=id-a})),
              2.5
            ),
            mul(
              exists(query({!df=cluster_id_ss v=id-b})),
              0.2
            )
          ),
          1.3
        )`.replace(/(\s+\n)|(\n\s+)|(\n)/g, '');

      const formula = relevanceContextItemToSolrFormula(testContext);
      assert.equal(formula, expectedFormula);
    });
  });
});
