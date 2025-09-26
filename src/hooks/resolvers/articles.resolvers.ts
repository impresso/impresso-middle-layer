import { buildResolvers } from '../../internalServices/cachedResolvers'
import { resolveAsync } from '../../util/solr/adapters'
import * as lodash from 'lodash'
import debug from 'debug'
import Topic from '../../models/topics.model'
import { HookContext } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'
import ArticleTopic from '../../models/articles-topics.model'
import Article from '../../models/articles.model'

const debugLogger = debug('impresso/hooks/resolvers:articles')

const resolveTopics = () => async (context: HookContext<ImpressoApplication>) => {
  if (!context.result) {
    debugLogger('resolveTopics: no "context.result" found')
  } else if (context.result.data && context.result.data.length) {
    const resolvers = buildResolvers(context.app)

    context.result.data = await Promise.all(
      context.result.data.map(async (d: Article) => {
        if (!d.topics) {
          return d
        }
        d.topics = await Promise.all(
          d.topics.map(async (at: ArticleTopic) => {
            at.topic = await resolvers.topic(at.topicUid!)
            return at
          })
        )
        return d
      })
    )
  } else if (context.result.topics && context.result.topics.length) {
    debugLogger(`resolveTopics: "context.result.topics" found with ${context.result.topics.length} topics`)

    /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
    const solr = context.app.service('simpleSolrClient')

    const group = await resolveAsync(solr, {
      Klass: Topic,
      namespace: 'topics',
      items: context.result.topics,
      idField: 'topicUid',
      itemField: 'topic',
    })
    context.result.topics = group.items?.sort((a, b) => ((a as any).relevance > (b as any).relevance ? -1 : 1))
  }
}

export { resolveTopics }
