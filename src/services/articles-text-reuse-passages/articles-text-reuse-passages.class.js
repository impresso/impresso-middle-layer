exports.ArticlesTextReusePassages = class ArticlesTextReusePassages {
  constructor(options, app) {
    this.app = app;
    this.options = options || {};
  }

  async find(params) {
    console.info('Requested text reuse passages for an article with parameters ', params);
    return [];
  }
};
