const axios = require('axios')
const debug = require('debug')('impresso/services:articles-recommendations')

class ArticlesRecommendations {
  constructor({ recommenderServiceUrl }) {
    this.recommenderServiceUrl = recommenderServiceUrl
    debug('recommenderServiceUrl', this.recommenderServiceUrl)
  }

  /**
   * Proxy for `https://github.com/impresso/impresso-recsys` recommend.
   * @param {any} data payload
   * @returns {Promise<any>}
   */
  async create(data) {
    const res = await axios
      .post(this.recommenderServiceUrl, data, {
        headers: { 'Content-Type': 'application/json' },
      })
      .catch(error => {
        debug('error', error)
        throw error
      })
    return res.data
  }
}

module.exports = { ArticlesRecommendations }
