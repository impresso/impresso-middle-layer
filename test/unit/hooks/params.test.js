import assert from 'assert'
import { validateRouteId, utils } from '@/hooks/params'
// usage from cli:
// mocha test/hooks/params.test.js
describe("'params' hook", () => {
  it('should throw an exception if the id does not respect the rule', async () => {
    await validateRouteId()({
      id: 'not a good one',
    }).catch(err => {
      assert.equal(err.name, 'BadRequest')
    })
  })

  it('should runs validateRouteId global hook', async () => {
    await validateRouteId()({
      id: 'this-is-a-good-one',
    }).catch(err => {
      assert.fail(err)
    })
  })
  ;[
    ['ciao "mamma Bella" e ciao"', 'ciao* AND "mamma Bella" AND ciao*'],
    ['amsterdam OR paris', 'amsterdam OR paris'],
    ['*amsterdam* paris', '*amsterdam* AND paris'],
    // @todo ['amsterdam*, roma', 'amsterdam* OR roma']
  ].forEach(d => {
    it(`should transform: /${d[0]}/ to lucene query: /${d[1]}/`, done => {
      assert.equal(utils.toLucene(d[0]), d[1])
      done()
    })
  })
})
