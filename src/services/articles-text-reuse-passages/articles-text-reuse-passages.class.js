exports.ArticlesTextReusePassages = class ArticlesTextReusePassages {
  constructor(options, app) {
    this.options = options || {};
    this.solrClient = app.get('solrClient');
  }

  async find(params) {
    console.info('Requested text reuse passages for an article with parameters ', params);
    return [];
  }
};
