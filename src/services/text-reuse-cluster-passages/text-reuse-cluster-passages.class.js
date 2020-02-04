/* eslint-disable no-unused-vars */
exports.TextReuseClusterPassages = class TextReuseClusterPassages {
  constructor(options = {}, app) {
    this.options = options;
  }

  async find(params) {
    const { clusterId, skip = 0, limit = 10 } = params.query;
    const info = { limit, offset: skip, total: 0 };
    return { passages: [], info };
  }
};
