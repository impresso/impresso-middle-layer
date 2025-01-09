import assert from 'assert'
import app from '../../src/app'

/*
  ./node_modules/.bin/eslint \
  src/services/articles \
  test/sanity-check.test.js \
  --config .eslintrc.json --fix &&
  NODE_ENV=development DEBUG=impresso/* mocha test/sanity-check.test.js
*/

describe("Newspaper issues and 'Public Domain' contents", function () {
  this.timeout(15000)

  it('get issue "not-found", should throw a not found.', async () => {
    const result = await app
      .service('issues')
      .get('NOT-FOUND')
      .catch(({ code }) => {
        assert.strictEqual(code, 404)
      })
    // result should be undefined;
    assert.strictEqual(result, undefined)
  })

  it('get issue "LCG-1851-12-24-a", Public Domain', async () => {
    const result = await app.service('issues').get('LCG-1851-12-24-a')
    // result should be undefined;
    assert.strictEqual(result.uid, 'LCG-1851-12-24-a')
    assert.strictEqual(result.cover, 'LCG-1851-12-24-a-p0001')
    assert.strictEqual(result.accessRights, 'OpenPublic')
    assert.strictEqual(result.pages[3].iiif, 'https://impresso-project.ch/api/proxy/iiif/LCG-1851-12-24-a-p0004')
  })

  it('get issue "actionfem-1927-10-15", Closed, no authentication (obfuscate)', async () => {
    const result = await app.service('issues').get('actionfem-1927-10-15-a')
    assert.strictEqual(result.uid, 'actionfem-1927-10-15-a')
    assert.strictEqual(result.cover, 'actionfem-1927-10-15-a-p0001')
    assert.strictEqual(result.accessRights, 'Closed')
    // check iiif;
    assert.strictEqual(result.pages[0].iiif, app.get('accessRights').unauthorizedIIIFUrl)
  })

  it('get issue "actionfem-1927-10-15-a", Closed, with authentication! (not obfuscate)', async () => {
    const result = await app.service('issues').get('actionfem-1927-10-15-a', {
      authenticated: true,
      user: {
        uid: 'local-user-not-guest',
      },
    })
    assert.strictEqual(result.uid, 'actionfem-1927-10-15-a')
    assert.strictEqual(result.cover, 'actionfem-1927-10-15-a-p0001')
    assert.strictEqual(result.accessRights, 'Closed')
    // check iiif;
    assert.notStrictEqual(result.pages[0].iiif, app.get('accessRights').unauthorizedIIIFUrl)
  })
})

describe("'OpenPrivate' behaviour", function () {
  this.timeout(15000)

  it('get issue "EXP-1857-11-19-a", OpenPrivate (obfuscate for the moment)', async () => {
    const result = await app.service('issues').get('EXP-1857-11-19-a', {
      authenticated: false,
    })
    assert.strictEqual(result.uid, 'EXP-1857-11-19-a')
    assert.strictEqual(result.cover, 'EXP-1857-11-19-a-p0001')
    assert.strictEqual(result.accessRights, 'OpenPrivate')
    // check iiif;
    assert.strictEqual(result.pages[0].iiif, app.get('accessRights').unauthorizedIIIFUrl)
  })

  it('get article "EXP-1857-11-19-a-i0001" obfuscated OpenPrivate', async () => {
    const result = await app.service('content-items').get('EXP-1857-11-19-a-i0001', {
      authenticated: false,
    })
    assert.strictEqual(result.issue.uid, 'EXP-1857-11-19-a')
    assert.strictEqual(result.issue.accessRights, 'OpenPrivate')
    assert.strictEqual(result.content, app.get('accessRights').unauthorizedContent)
    assert.strictEqual(result.obfuscated, true)
    // check iiif;
    assert.strictEqual(result.pages[0].iiif, app.get('accessRights').unauthorizedIIIFUrl)
  })
  it('get article "EXP-1857-11-19-a-i0001" OpenPrivate, but authentified!', async () => {
    const result = await app.service('content-items').get('EXP-1857-11-19-a-i0001', {
      authenticated: true,
      user: {
        uid: 'local-user-not-guest',
      },
    })
    assert.strictEqual(result.issue.uid, 'EXP-1857-11-19-a')
    assert.strictEqual(result.issue.accessRights, 'OpenPrivate')
    assert.notStrictEqual(result.content, app.get('accessRights').unauthorizedContent)
    assert.strictEqual(result.obfuscated, undefined)
    // check iiif;
    assert.notStrictEqual(result.pages[0].iiif, app.get('accessRights').unauthorizedIIIFUrl)
  })
})

describe("'Luxwort' contents", function () {
  this.timeout(15000)

  let service

  before(async () => {
    service = app.service('content-items')
  })

  it('registered the service', () => {
    assert.ok(service)
  })

  it('get article "luxwort-1927-07-13-a-i0051", check excerpt in language DE and IIIF', async () => {
    const result = await service.get('luxwort-1927-07-13-a-i0051')
    assert.ok(result)
    assert.strictEqual(result.title, 'Pub. 14 Page 6', 'check title')
    assert.strictEqual(
      result.excerpt,
      'La tainills Remerciements famille J.-P. Peters-Schmitz, pprrooffoonnddés-- ment touchée des nombreuses marques de Sympathie et de condoléances gui lvi ont...',
      'check excerpt'
    )
  })

  it('get article "actionfem-1927-10-15-a-i0012", check custom iiif and title FR and content DE', async () => {
    const result = await service.get('actionfem-1927-10-15-a-i0012')
    assert.strictEqual(result.title, 'Unsere Einstellung.')
    assert.strictEqual(
      result.excerpt,
      "Es gereicht uns zur besonderen Genugtuung, am heutigen Tage die erste Nummer L'Action Féminine der Oeffentlichteit zu übergeben. Unsere Monatsschrift..."
    )
    // assert.strictEqual(result.pages[0].iiif, 'https://iiif.eluxemburgensia.lu/iiif/2/ark:%2f70795%2fs8qgx6%2fpages%2f1/info.json', 'external iiif');
  })
})

// WRONG table of content generated for
// https://solrdev.dhlab.epfl.ch/solr/impresso_dev/select?q=id:luxland-2007-12-21-a-i0001

describe('Test /images service for crazy contents', function () {
  this.timeout(5000)

  let service

  before(async () => {
    service = app.service('images')
  })

  it('get NO images from issue obermosel-1930-12-23-a without errors', async () => {
    assert.ok(service)
    const result = await service.find({
      query: {
        filters: [
          {
            type: 'issue',
            q: 'obermosel-1930-12-23-a',
          },
        ],
      },
    })
    assert.strictEqual(result.total, 0)
  })

  it('get images from issue GDL-1998-02-28-a', async () => {
    const result = await service.find({
      query: {
        filters: [
          {
            type: 'issue',
            q: 'GDL-1998-02-28-a',
          },
        ],
      },
    })
    assert.strictEqual(result.total > 0, true)
  })
})
// WRONG table of content generated for
// https://solrdev.dhlab.epfl.ch/solr/impresso_dev/select?q=id:luxland-2007-12-21-a-i0001

// test search capabilities
// http://localhost:3030/search?group_by=articles&filters[0][type]=newspaper&filters[0]
// [q][]=JDG&filters[0]
// [q][]=EXP&filters[1][type]=string&filters[1][q]=Louis%20Blondel&facets=year,type,country
