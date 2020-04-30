// @ts-check
const { default: fetch } = require('node-fetch');

class ArticlesRecommendations {
  constructor({ recommenderServiceUrl }) {
    this.recommenderServiceUrl = recommenderServiceUrl;
  }

  /**
   * Proxy for `https://github.com/impresso/impresso-recsys` recommend.
   * @param {any} data payload
   * @returns {Promise<any>}
   */
  async create(data) {
    return fetch(this.recommenderServiceUrl, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    }).then(response => response.json());
  }
}

module.exports = { ArticlesRecommendations };
