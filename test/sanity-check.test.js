const assert = require('assert');
const app = require('../src/app');

/*
  ./node_modules/.bin/eslint \
  src/services/articles \
  test/sanity-check.test.js \
  --config .eslintrc.json --fix &&
  DEBUG=impresso/* mocha test/sanity-check.test.js
*/
describe('\'Luxwort\' contents', function () {
  this.timeout(15000);

  const service = app.service('articles');

  it('registered the service', () => {
    assert.ok(service);
  });

  it('get article "luxwort-1927-07-13-a-i0051", check excerpt in language DE and IIIF', async () => {
    const result = await service.get('luxwort-1927-07-13-a-i0051');
    assert.ok(result);
    assert.strictEqual(result.title, 'Pub. 14 Page 6', 'check title');
    assert.strictEqual(result.excerpt, 'La tainills Remerciements famille J.-P. Peters-Schmitz, pprrooffoonnddés-- ment touchée des nombreuses marques de Sympathie et de condoléances gui lvi ont...', 'check excerpt');
  });

  it('get article "actionfem-1927-10-15-a-i0012", check custom iiif and title FR and content DE', async () => {
    const result = await service.get('actionfem-1927-10-15-a-i0012');
    assert.strictEqual(result.title, 'Unsere Einstellung.');
    assert.strictEqual(result.excerpt, "Es gereicht uns zur besonderen Genugtuung, am heutigen Tage die erste Nummer L'Action Féminine der Oeffentlichteit zu übergeben. Unsere Monatsschrift...");
    assert.strictEqual(result.pages[0].iiif, 'https://iiif.eluxemburgensia.lu/iiif/2/ark:%2f70795%2fs8qgx6%2fpages%2f1/info.json', 'external iiif');
  });
});


// test search capabilities
// http://localhost:3030/search?group_by=articles&filters[0][type]=newspaper&filters[0]
// [q][]=JDG&filters[0]
// [q][]=EXP&filters[1][type]=string&filters[1][q]=Louis%20Blondel&facets=year,type,country
