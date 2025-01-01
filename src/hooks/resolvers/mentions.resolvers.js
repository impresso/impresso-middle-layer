import { SolrNamespaces } from '@/solr'
import { findByIds } from '@/solr/queryBuilders'
import { findAllResponseAdapter } from '../../util/solr/adapters'
const lodash = require('lodash')
const debug = require('debug')('impresso/hooks/resolvers:mentions')
const Article = require('../../models/articles.model')
const { toTextWrap } = require('../../helpers')
/**
 * ResolveArticles by ids
 * @param  {String} [key='articleUid'] [description]
 * @return {[type]}                    [description]
 */
const resolveArticles =
  // prettier-ignore
  (key = 'articleUid') => async context => {
    // get article uids from entityMentions
    const uids = context.result.data.map(d => d[key])

    const solr = context.app.service('simpleSolrClient')

    debug('[resolveArticles]: load solr contents uids', uids)

    const response = await solr.select(SolrNamespaces.Search, findByIds(uids, Article.ARTICLE_SOLR_FL_LITE))
    const results = findAllResponseAdapter(response, Article.solrFactory)

    debug('[resolveArticles]: uids', uids)
    const articles = lodash.keyBy(results.response.docs, 'uid')
    // enrich thanks to uid ordering, then get
    uids.forEach((uid, i) => {
      if (articles[uid]) {
        context.result.data[i].article = articles[uid]
        // console.log(context.result.data[i], articles[uid].content);
        context.result.data[i].context = toTextWrap({
          text: `${articles[uid].content}`,
          l: context.result.data[i].l,
          r: context.result.data[i].r,
          ref: `highlight ${context.result.data[i].type} uid-${context.result.data[i].entityId}`,
          d: 50,
        })
        // remove contents
        delete context.result.data[i].article.content
      }
    })
  }

module.exports = {
  resolveArticles,
}
