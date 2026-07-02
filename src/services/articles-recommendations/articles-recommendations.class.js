import axios from 'axios'
import { getLogger } from '@/logger.js'

const logger = getLogger(['impresso', 'services', 'articles-recommendations'])

class ArticlesRecommendations {
  constructor({ recommenderServiceUrl }) {
    this.recommenderServiceUrl = recommenderServiceUrl
    logger.debug('recommenderServiceUrl', this.recommenderServiceUrl)
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
        logger.debug('error', { error })
        throw error
      })
    return res.data
  }
}

export { ArticlesRecommendations }
