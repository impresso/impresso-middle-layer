const assert = require('assert')
const app = require('../../../src/app')

/**
./node_modules/.bin/eslint \
test/services/images.test.js \
src/services/images \
--config .eslintrc.json --fix \
&& NODE_ENV=production DEBUG=impresso* mocha test/services/images.test.js
*/
describe("'images' service", function () {
  this.timeout(20000)
  const service = app.service('images')

  it('registered a working service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('call find method with title! filter', async () => {
    const result = await service.find({
      query: {
        filters: [
          {
            type: 'title',
            q: 'Bahnhof',
          },
        ],
      },
    })
    assert.ok(
      result.data[0].title.toLowerCase().indexOf('bahnhof') !== -1,
      '"banhof" should appear in "title" property'
    )
  })

  it('call find method with basic filter', async () => {
    const result = await service.find({
      query: {
        filters: [
          {
            type: 'newspaper',
            q: ['GDL'],
          },
          {
            type: 'year',
            q: [1970, 1971],
          },
        ],
      },
    })
    assert.ok(result.data, 'theres data')
    assert.deepEqual(
      result.info.queryComponents[0].items[0].name,
      'Gazette de Lausanne',
      'newspaper has been translated to an item'
    )
    assert.deepEqual(result.info.filters[1].q.join(','), '1970,1971', 'filters should be given in info')
  })

  it('check IIIF manifest for external IIIF services!', async () => {
    const result = await service.find({
      query: {
        filters: [
          {
            type: 'newspaper',
            q: ['luxland'],
          },
          {
            type: 'title',
            q: 'bilder',
          },
        ],
      },
    })
    assert.strictEqual(result.data[0].pages[0].iiif.indexOf('https://iiif.eluxemburgensia.lu/'), 0)
  })

  it('find similar images to a newspaper image', async () => {
    const result = await service.find({
      query: {
        similarTo: 'GDL-1950-12-23-a-i0107', // 'GDL-1950-03-28-a-i0103',
        filters: [
          {
            type: 'newspaper',
            q: ['GDL'],
          },
          {
            type: 'year',
            q: [1970],
          },
        ],
      },
    })
    assert.ok(result.data, 'theres data')
    assert.deepEqual(result.limit, 10)
    assert.deepEqual(result.offset, 0)
    assert.deepEqual(
      result.info.queryComponents[0].items[0].name,
      'Gazette de Lausanne',
      'newspaper has been translated to an item'
    )
    assert.ok(result)
  })

  it('find similar images to a upser uploaded image, with filters', async () => {
    const result = await service.find({
      query: {
        similarToUploaded: 'test', // 'GDL-1950-03-28-a-i0103',
        filters: [
          {
            type: 'newspaper',
            q: ['GDL'],
          },
          {
            type: 'year',
            q: [1970],
          },
        ],
      },
    })
    assert.ok(result.data, 'theres data')
    assert.deepEqual(result.limit, 10)
    assert.deepEqual(result.offset, 0)
    assert.deepEqual(
      result.info.queryComponents[0].items[0].name,
      'Gazette de Lausanne',
      'newspaper has been translated to an item'
    )
    assert.ok(result)
  })
})
