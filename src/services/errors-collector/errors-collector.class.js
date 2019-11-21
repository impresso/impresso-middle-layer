/* eslint-disable no-unused-vars */
class ErrorsCollector {
  async create(data = {}) {
    const {
      type = '',
      name = '',
      message = '',
      stack = '',
      uri = 'N/A',
      hook = {},
    } = data;
    const params = [];
    // get params
    if (hook.params) {
      if (hook.params.user) {
        params.push(`user:${hook.params.user.uid}`);
      }
      if (hook.params.query) {
        params.push(`qs:${JSON.stringify(hook.params.query)}`);
      }
    }
    const readableMessage = `[Front End Error] (${type || 'GenericError'}:${name}) at "${uri}": ${message} - ${params.join(' - ')}`;
    console.error(readableMessage, stack);
    return Promise.resolve({ ok: 1, stderr: readableMessage });
  }
}

module.exports = function (options) {
  return new ErrorsCollector(options);
};

module.exports.Service = ErrorsCollector;
