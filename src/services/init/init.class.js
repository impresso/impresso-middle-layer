/* eslint-disable no-unused-vars */
export class Service {
  constructor({ app } = {}) {
    this.app = app
  }

  async find(params) {
    const newspapers = await this.app.service('media-sources').findMediaSources({
      limit: 1000,
      type: 'newspaper',
    })
    return {
      startDate: '1780-01-12T00:00:00Z',
      endDate: '1997-12-31T00:00:00Z',
      newspapers: newspapers.data,
    }
  }
}

export default function (options) {
  return new Service(options)
}
