/* eslint-disable no-unused-vars */
class Service {
  constructor (options) {
    this.options = options || {};
  }

  async get (id, params) {
    return {
      id, text: `A new message with ID: ${id}!`
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
