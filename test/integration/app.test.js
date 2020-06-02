const { default: fetch } = require('node-fetch');
const assert = require('assert');
const app = require('../../src/app');

const rp = async url => fetch(url).then(res => res.text());

describe('Feathers application tests', () => {
  before(function (done) {
    this.server = app.listen(3030);
    this.server.once('listening', () => done());
  });

  after(function (done) {
    this.server.close(done);
  });

  it('starts and shows the index page', () => rp('http://localhost:3030').then(body => assert.ok(body.indexOf('<html>') !== -1)));

  describe('404', () => {
    it('shows a 404 HTML page', () => rp({
      url: 'http://localhost:3030/path/to/nowhere',
      headers: {
        Accept: 'text/html',
      },
    }).catch((res) => {
      assert.equal(res.statusCode, 404);
      assert.ok(res.error.indexOf('<html>') !== -1);
    }));

    it('shows a 404 JSON error without stack trace', () => rp({
      url: 'http://localhost:3030/path/to/nowhere',
      json: true,
    }).catch((res) => {
      assert.equal(res.statusCode, 404);
      assert.equal(res.error.message, 'Not found');
    }));
  });

  describe('app hooks', () => {
    it('deny access to bad URLS', () => app.service('/articles')
      .get('orororo r').catch((err) => {
        assert.equal(err.code, 400);
      }));
    it('allow access to good URLS', () => app.service('/articles')
      .get('not-found').catch((err) => {
        assert.equal(err.code, 404);
      }));
  });
});
