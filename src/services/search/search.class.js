const debug = require('debug')('impresso/services:search')
const { protobuf } = require('impresso-jscommons')
const { NotFound, NotImplemented } = require('@feathersjs/errors')
const sequelize = require('../../sequelize')
const Article = require('../../models/articles.model')
const Collection = require('../../models/collections.model')
const Job = require('../../models/jobs.model')
const {
  getItemsFromSolrResponse,
  getFacetsFromSolrResponse,
  getTotalFromSolrResponse,
} = require('../search/search.extractors')
const { measureTime } = require('../../util/instruments')
const { asFindAll } = require('../../util/solr/adapters')

class Service {
  /**
   * Search service. According to group, deliver a different thing.
   *
   * Add solr
   * @param  {object} options pass the current app in app
   */
  constructor({ app, name } = {}) {
    this.app = app
    this.solr = app.service('simpleSolrClient')
    this.sequelize = sequelize.client(app.get('sequelize'))
    this.name = name
  }

  static wrap(data, limit, offset, total, info) {
    return {
      data,
      limit,
      offset,
      total,
      info,
    }
  }

  static asRawResponse(solrResponse, params, total) {
    return Service.wrap(
      solrResponse.response.docs.map(d => {
        // console.log(_solr.fragments[d.id]);
        const contentField = Object.keys(solrResponse.fragments[d.id])[0]
        // const contentField = _solr.fragments[d.id][`content_txt_${d.lg_s}`]
        // ? `content_txt_${d.lg_s}` : 'content_txt_fr';
        const fragments = solrResponse.fragments[d.id][contentField]
        const highlights = solrResponse.highlighting[d.id][contentField]
        return {
          id: d.id,
          matches: Article.getMatches({
            solrDocument: d,
            highlights,
            fragments,
          }),
          contentField,
        }
      }),
      params.query.limit,
      params.query.offset,
      total
    )
  }

  /**
   * Save current search and return the corrseponding searchQuery
   * @param  {[type]}  data   [description]
   * @param  {[type]}  params [description]
   * @return {Promise}        [description]
   */
  async create(data, params) {
    const client = this.app.get('celeryClient')
    if (!client) {
      return {}
    }

    // quickly save the data!
    const q = data.sanitized.sq
    const taskname = data.sanitized.taskname
    const sq = protobuf.searchQuery.serialize({
      filters: data.sanitized.filters,
    })
    // create new search query :TODO
    debug(
      `[create] taskname ${taskname} from solr query: ${q} from user:${params.user.uid} collection_uid: ${data.sanitized.collection_uid}`
    )
    // check if the user has jobs running
    const jobKlass = Job.sequelize(this.sequelize)
    const runningJobs = await jobKlass.count({
      where: {
        creatorId: params.user.id,
        status: 'RUN',
      },
    })
    if (runningJobs > 0) {
      throw new NotImplemented(`too many jobs running: ${runningJobs}`)
    }
    const collectionKlass = Collection.sequelize(this.sequelize)
    // check if the collection exists
    const collection = await collectionKlass.findOne({
      where: {
        uid: data.sanitized.collection_uid,
        creatorId: params.user.id,
      },
    })
    if (!collection) {
      throw new NotFound()
    }

    debug('[create] collection found:', collection.name)

    // Celery task:
    // def add_to_collection_from_query(
    //     self, collection_id, user_id, query, content_type,
    //     fq=None, serialized_query=None
    // ):
    return client
      .run({
        task: `impresso.tasks.${taskname}`,
        args: [
          // collection_uid
          data.sanitized.collection_uid,
          // user id
          params.user.id,
          // query
          q,
          // content_type, A for article
          'A',
          // fq
          '',
          // serialized query, for future use
          sq,
        ],
      })
      .catch(err => {
        if (err.result.exc_type === 'DoesNotExist') {
          // probably collection does not exist
          debug('[create] impresso.tasks.add_to_collection_from_query DoesNotExist.', err)
          throw new NotFound(err.result.exc_message)
        } else if (err.result.exc_type === 'OperationalError') {
          // probably db is not available
          debug('[create] impresso.tasks.add_to_collection_from_query OperationalError.', err)
          throw new NotImplemented()
        }
        debug('[create] impresso.tasks.add_to_collection_from_query ERROR.', err)
        throw new NotImplemented()
      })
      .then(res => {
        debug('[create] impresso.tasks.add_to_collection_from_query SUCCESS.', res)
        return {}
      })
  }

  /**
   * async find - generic /search endpoint, this method gets matches from solr
   * and map the results with articles or pages.
   *
   * @param  {object} params query params. Check hhooks
   */
  async find(params) {
    debug('[find] query:', params.query, params.sanitized.sv)
    const isRaw = params.originalQuery.group_by === 'raw'
    let fl = 'id,pp_plain:[json],lg_s'

    fl = 'id,rc_plains,lg_s' // ,pp_plain:[json]';

    const solrQuery = {
      q: params.query.sq,
      // fq: params.sanitized.sfq,
      order_by: params.query.order_by,
      facets: params.query.facets != null ? JSON.parse(params.query.facets) : params.query.facets,
      limit: params.query.limit,
      offset: params.query.offset,
      fl, // other fields can be loaded later on
      highlight_by: 'content_txt_de,content_txt_fr,content_txt_en',
      highlightProps: {
        'hl.snippets': 10,
        'hl.fragsize': 100,
      },
      vars: params.sanitized.sv,
    }

    // const solrResponse = await measureTime(
    //   () =>
    //     this.solr.findAllPost(solrQuery, {
    //       skipCache: !isCacheableQuery(params.sanitized.filters),
    //     }),
    //   'search.find.solr.search'
    // )
    const solrResponse = await asFindAll(this.solr, 'search', solrQuery)

    const total = getTotalFromSolrResponse(solrResponse)
    debug(`find '${this.name}' (1 / 2): SOLR found ${total} using SOLR params:`, solrResponse.responseHeader)

    if (!total) {
      return Service.wrap([], params.query.limit, params.query.offset, total)
    }

    if (isRaw) {
      return Service.asRawResponse(solrResponse, params, total)
    }

    const userInfo = {
      user: params.user,
      authenticated: params.authenticated,
    }

    debug(
      `find '${this.name}' (2 / 2): call articles service for ${solrResponse.response.docs.length} uids, user:`,
      params.user ? params.user.uid : 'no auth user found'
    )

    const resultItems = await measureTime(
      () => getItemsFromSolrResponse(solrResponse, this.app.service('content-items'), userInfo),
      'search.find.svc.articles'
    )
    const facets = await getFacetsFromSolrResponse(solrResponse, this.app)

    return Service.wrap(resultItems, params.query.limit, params.query.offset, total, {
      responseTime: {
        solr: solrResponse.responseHeader.QTime,
      },
      facets,
    })
  }
}

module.exports = function (options) {
  return new Service(options)
}

module.exports.Service = Service
