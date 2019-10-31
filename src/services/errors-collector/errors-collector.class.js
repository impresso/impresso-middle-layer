exports.ErrorsCollector = class ErrorsCollector {
  async create(data = {}) {
    const {
      type = '',
      message = '',
      stack = '',
      uri = 'N/A',
    } = data;
    console.error(`[Front End Error] (${type}) at "${uri}": ${message} ${stack}`);
    return Promise.resolve({ ok: 1 });
  }
};
