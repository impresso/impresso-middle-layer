class ArticleTopic {
  constructor({ topic = null, topicUid = '', article = null, articleUid = '', relevance = 0.0 } = {}) {
    if (topic) {
      this.topic = topic
    }
    if (topicUid) {
      this.topicUid = String(topicUid)
    }
    if (article) {
      this.article = article
    }
    if (articleUid) {
      this.articleUid = String(articleUid)
    }
    this.relevance = parseFloat(relevance)
  }

  /**
   * Originally, topic links are stored as dpfs values
   * topics_dpfs": Array[1][
   *        "tmrero-fr-alpha_tp11_fr|0.0488 tmrero-fr-alpha_tp32_fr|0.2631
   *        tmrero-fr-alpha_tp33_fr|0.2155 tmrero-fr-alpha_tp42_fr|0.025
   *        tmrero-fr-alpha_tp55_fr|0.3107 tmrero-fr-alpha_tp67_fr|0.025 "
   *    ],
   * @param  {Array} dpfs [description]
   * @return {Array}  array of Topic instances
   */
  static solrDPFsFactory(dpfs) {
    if (!dpfs || !dpfs.length) {
      return []
    }
    return dpfs[0]
      .trim()
      .split(' ')
      .map(d => {
        const parts = d.split('|')
        return new ArticleTopic({
          topicUid: parts[0],
          relevance: parts[1],
        })
      })
  }
}

export default ArticleTopic
export const Model = ArticleTopic
