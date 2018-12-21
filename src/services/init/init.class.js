/* eslint-disable no-unused-vars */
class Service {
  constructor({
    app,
  } = {}) {
    this.app = app;
  }

  async find(params) {
    const newspapers = await this.app.service('newspapers').find({
      query: {
        limit: 1000,
      },
    });
    return {
      startDate: '1780-01-12T00:00:00Z',
      endDate: '1997-12-31T00:00:00Z',
      newspapers: newspapers.data,
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
