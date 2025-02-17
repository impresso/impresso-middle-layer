/* eslint-disable no-unused-vars */
import { mediaSourceToNewspaper } from '../newspapers/newspapers.class'
import { SolrNamespaces } from '../../solr'
const debug = require('debug')('impresso/services:suggestions')
const chrono = require('chrono-node')
const moment = require('moment')
const lodash = require('lodash')

const { NotFound, NotImplemented } = require('@feathersjs/errors')
const { latinise, toPlainText } = require('../../helpers')

const Mention = require('../../models/mentions.model')
const Entity = require('../../models/entities.model')
const Topic = require('../../models/topics.model')
const Suggestion = require('../../models/suggestions.model')
const { measureTime } = require('../../util/instruments')

const MULTI_YEAR_RANGE = /^\s*(\d{4})(\s*(to|-)\s*(\d{4})\s*)?$/

const asEntitySuggestion = doc => {
  // payload shoyld be a string formatted as 'id|type',
  // like 'aida-0001-Testament_(comics)|Person'
  const [uid, type] = doc.payload.split('|')
  const item = new Entity({
    uid,
    name: Entity.getNameFromUid(uid),
    type,
  })
  return new Suggestion({
    q: item.uid,
    h: Entity.getNameFromUid(doc.term),
    type: item.type,
    item,
    weight: doc.weight,
  })
}

const asMentionSuggestion = doc => {
  // payload form ention contain type only
  const item = new Mention({
    name: doc.term.replace(/<[^>]*>/g, ''),
    frequence: doc.weight,
    type: doc.payload,
  })
  return new Suggestion({
    q: item.name,
    h: doc.term,
    type: 'mention',
    item,
    weight: item.frequence,
  })
}

const asTopicSuggestion = doc => {
  const topic = Topic.solrSuggestFactory()(doc)
  // console.log(topic);
  return new Suggestion({
    q: topic.uid,
    h: topic.getExcerpt().join(' '),
    type: 'topic',
    item: topic,
  })
}

class Service {
  constructor({ app, name }) {
    this.app = app
    this.name = name
  }

  /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
  get solr() {
    return this.app.service('simpleSolrClient')
  }

  suggestNewspapers({ q }) {
    debug('suggestNewspapers for q:', q)
    return this.app
      .service('media-sources')
      .findMediaSources({
        term: q,
        limit: 3,
        type: 'newspaper',
      })
      .then(res => {
        debug('suggestNewspapers SUCCESS q:', q)
        return res.data.map(mediaSourceToNewspaper)
      })
      .then(data =>
        data.map(
          d =>
            new Suggestion({
              type: 'newspaper',
              h: d.name,
              q: d.uid,
              uid: d.uid,
              item: d,
            })
        )
      )
  }

  suggestCollections({ q, user }) {
    if (!user || !user.id) {
      return []
    }
    debug('suggestCollections for q:', q)
    return this.app
      .service('collections')
      .find({
        query: {
          q,
          limit: 3,
        },
        user,
      })
      .then(res => {
        debug('suggestCollections SUCCESS q:', q)
        return res
      })
      .then(({ data }) =>
        data.map(
          d =>
            new Suggestion({
              q: d.uid,
              h: d.name,
              type: 'collection',
              item: d,
            })
        )
      )
  }

  async suggestItem(q, type, builder) {
    const request = { q, count: 3 }
    const result = await this.solr.suggest(type, request)
    return (result.suggestions ?? []).map(builder)
  }

  async suggestEntities({ q }) {
    return await this.suggestItem(q, SolrNamespaces.Entities, asEntitySuggestion)
  }

  async suggestMentions({ q }) {
    return await this.suggestItem(q, SolrNamespaces.Mentions, asMentionSuggestion)
  }

  async suggestTopics({ q }) {
    return await this.suggestItem(q, SolrNamespaces.Topics, asTopicSuggestion)
  }

  async get(type, params) {
    switch (type) {
      case 'topic':
        return this.suggestTopics({
          q: toPlainText(params.query.q),
        })
      case 'newspaper':
        return this.suggestNewspapers({
          q: toPlainText(params.query.q),
        })
      case 'collection':
        return this.suggestCollections({
          q: toPlainText(params.query.q),
          user: params.user,
        })
      case 'person':
      case 'location':
      case 'entity':
        return this.suggestEntities({
          q: toPlainText(params.query.q),
          type,
        })
      case 'mention':
        return this.suggestMentions({
          q: toPlainText(params.query.q),
        })
      default:
        throw new NotFound()
    }
  }

  async find(params) {
    const self = this
    debug('[find] params.query.q:', params.query.q)
    const asregex = async () => {
      if (params.query.q.indexOf('/') === 0) {
        try {
          const a = RegExp(params.query.q)
        } catch (e) {
          return []
        }

        return [
          {
            type: 'regex',
            q: params.query.q,
            context: 'include',
          },
        ]
      }
      return []
    }

    const articletitles = async () => {}

    const dateranges = async () => {
      const myears = params.query.q.match(MULTI_YEAR_RANGE)

      if (myears) {
        const start = moment.utc(`${myears[1]}-01-01`).format()
        const end = moment
          .utc(myears[4] ? `${myears[4]}-12-31` : `${myears[1]}-12-31`)
          .endOf('day')
          .format()

        return [
          {
            type: 'daterange',
            context: 'include',
            daterange: `${start} TO ${end}`,
          },
        ]
      }
      // if a date hasnt been recognized by our basic regex.
      const asdate = chrono.parse(params.query.q)

      if (asdate.length) {
        return asdate
          .map(d => {
            if (!d.start) {
              return false
            }
            const start = moment.utc(d.start.date()).format()
            let end
            if (d.end && d.end.knownValues.day) {
              end = moment.utc(d.end.date()).endOf('day').format()
            } else if (d.end && d.end.knownValues.month) {
              end = moment.utc(d.end.date()).endOf('month').format()
            } else if (d.end && d.end.knownValues.month) {
              end = moment.utc(d.end.date()).endOf('year').format()
            } else if (d.start.knownValues.day) {
              end = moment.utc(d.start.date()).endOf('day').format()
            } else if (d.start.knownValues.month) {
              end = moment.utc(d.start.date()).endOf('month').format()
            } else if (d.start.knownValues.year) {
              end = moment.utc(d.start.date()).endOf('year').format()
            }

            if (!end) {
              return false
            }
            return {
              type: 'daterange',
              text: d.text,
              context: 'include',
              daterange: `${start} TO ${end}`,
            }
          })
          .filter(d => d !== false)
      }

      return []
    }

    const qPlainText = toPlainText(params.query.q)

    if (!qPlainText.length) {
      return {
        data: [],
      }
    }
    // let newspapers = () => this._run()
    return Promise.all([
      asregex(),
      dateranges(), // dates(),
      // entities(),
      /* NOTE: we do not suggest collections by default because they
         cannot be cached. */
      // this.suggestCollections({
      //   q: qPlainText,
      //   user: params.user,
      // }),
      this.suggestNewspapers({
        q: qPlainText,
      }),
      this.suggestTopics({
        q: qPlainText,
      }),
      this.suggestMentions({
        q: qPlainText,
      }),
      this.suggestEntities({
        q: qPlainText,
      }),
    ]).then(values => {
      debug('[find] SUCCESS for params.query.q:', params.query.q)
      // Use Array.prototype.flat() to flatten the array of suggestions
      const suggestions = values.flat().filter(item => item != null)
      // .flatten(values)
      // .filter(d => !lodash.isEmpty(d))
      // .value()
      return {
        data: suggestions,
      }
    })
  }
}

module.exports = function (options) {
  return new Service(options)
}

module.exports.Service = Service
