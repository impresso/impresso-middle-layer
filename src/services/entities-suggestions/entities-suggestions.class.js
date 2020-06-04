/* eslint-disable no-unused-vars */
exports.EntitiesSuggestions = class EntitiesSuggestions {
  constructor(app) {
    this.solr = app.get('cachedSolr');
  }

  /**
   * Suggest similar entities.
   * NOTE: using `create` because of potentially big payloads.
   * @typedef {{ names: string[] }} Payload
   * @param {Payload} payload
   */
  async create({ names }) {
    return {
      results: [
        {
          uid: '123',
          type: 'person',
          name: 'foo',
          matches: [],
          countItems: 1,
          countMentions: 2,
        },
      ],
      pagination: {
        limit: 20,
        skip: 0,
        total: 200,
      },
    };
  }
};
