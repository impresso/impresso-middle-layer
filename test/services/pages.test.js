const assert = require('assert');
const app = require('../../src/app');

describe('\'pages\' service', () => {
  const service = app.service('pages');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('if there\'s an user_uid, get the buckets associate to the page', async () => {
    const pag = await service.get('GDL-1882-06-01-a-p0002', {
      user: {
        uid: 'local-user-test-only',
      },
    });

    // console.log(pag);
    assert.ok(pag.labels, 'has label');
    assert.ok(pag.iiif, 'has iiif proxied');
    assert.ok(Array.isArray(pag.buckets), 'has buckets');
    assert.ok(Array.isArray(pag.regions), 'has regions');
    // assert.ok(pag.labbellos, 'has label');
  });
});
