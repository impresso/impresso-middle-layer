const assert = require("assert");
const {
  buildSolrQuery,
} = require("../../src/services/entities-mentions/entities-mentions.class");

describe("'entities-mentions' service", () => {
  it("builds Solr query", () => {
    const filters = [
      {
        type: "string",
        q: ["Jacque Chira"],
      },
      {
        type: "mentionFunction",
        q: "ministre",
      },
    ];
    const query = buildSolrQuery(filters);
    const expectedQuery = {
      query:
        "((mentionSuggest:Jacque AND mentionSuggest:Chira*) OR (entitySuggest:Jacque AND entitySuggest:Chira*)) AND filter(m_function_s:ministre)",
      params: {
        group: true,
        "group.field": "e_id_s",
        "group.format": "simple",
        rows: 10,
        start: 0,
      },
    };

    assert.deepStrictEqual(query, expectedQuery);
  });

  it("builds simple Solr query", () => {
    const filters = [
      {
        type: "string",
        q: "Chira",
      },
    ];
    const query = buildSolrQuery(filters, 5, 10);
    const expectedQuery = {
      query: "(mentionSuggest:Chira* OR entitySuggest:Chira*)",
      params: {
        group: true,
        "group.field": "e_id_s",
        "group.format": "simple",
        rows: 5,
        start: 10,
      },
    };

    assert.deepStrictEqual(query, expectedQuery);
  });
});
