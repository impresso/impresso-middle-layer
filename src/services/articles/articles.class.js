const { keyBy } = require('lodash');
const debug = require('debug')('impresso/services:articles');
const { Op } = require('sequelize');
const { NotFound } = require('@feathersjs/errors');

const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');
const Article = require('../../models/articles.model');
const Issue = require('../../models/issues.model');
const { measureTime } = require('../../util/instruments');

function getIssues(request, app) {
  const sequelize = app.get('sequelizeClient');
  const cacheManager = app.get('cacheManager');
  const cacheKey = SequelizeService.getCacheKeyForReadSqlRequest(request, 'issues');

  return cacheManager.wrap(
    cacheKey,
    () => Issue.sequelize(sequelize)
      .findAll(request)
      .then(rows => rows.map(d => d.get())),
  ).then(rows => keyBy(rows, 'uid'));
}

class Service {
  constructor({
    name = '',
    app,
  } = {}) {
    this.name = String(name);
    this.app = app;
    this.SequelizeService = SequelizeService({
      app,
      name,
      cacheReads: true,
    });
    this.SolrService = SolrService({
      app,
      name,
      namespace: 'search',
    });
  }

  async find(params) {
    const fl = Article.ARTICLE_SOLR_FL_LIST_ITEM;
    const pageUids = (params.query.filters || [])
      .filter(d => d.type === 'page')
      .map(d => d.q);

    debug('[find] use auth user:', params.user ? params.user.uid : 'no user');
    // if(params.isSafe query.filters)
    const results = await measureTime(() => this.SolrService.find({
      ...params,
      fl,
    }), 'articles.find.solr');

    // go out if there's nothing to do.
    if (results.total === 0) {
      return results;
    }

    // add newspapers and other things from this class sequelize method
    const getAddonsPromise = await measureTime(() => this.SequelizeService.find({
      ...params,
      scope: 'get',
      where: {
        uid: { [Op.in]: results.data.map(d => d.uid) },
      },
      limit: results.data.length,
      order_by: [['uid', 'DESC']],
    }).catch((err) => {
      console.error(err);
      return { data: [] };
    }).then(({ data }) => keyBy(data, 'uid')), 'articles.find.db.articles');

    // get accessRights from issues table
    const issuesRequest = {
      attributes: [
        'accessRights', 'uid',
      ],
      where: {
        uid: { [Op.in]: results.data.map(d => d.issue.uid) },
      },
    };
    const getRelatedIssuesPromise = await measureTime(
      () => getIssues(issuesRequest, this.app),
      'articles.find.db.issues',
    );

    // do the loop
    return Promise.all([
      getAddonsPromise,
      getRelatedIssuesPromise,
    ]).then(([addonsIndex, issuesIndex]) => ({
      ...results,
      data: results.data.map((article) => {
        if (issuesIndex[article.issue.uid]) {
          article.issue.accessRights = issuesIndex[article.issue.uid].accessRights;
        }
        if (!addonsIndex[article.uid]) {
          debug('[find] no pages for uid', article.uid);
          return article;
        }
        // add pages
        if (addonsIndex[article.uid].pages) {
          article.pages = addonsIndex[article.uid].pages; // .map(d => d.toJSON());
        }
        if (pageUids.length === 1) {
          article.regions = article.regions.filter(r => pageUids.indexOf(r.pageUid) !== -1);
        }
        article.assignIIIF();
        return article;
      }),
    }));
  }

  async get(id, params) {
    const uids = id.split(',');
    if (uids.length > 1 || params.findAll) {
      debug(`[get] with ${uids.length} ids -> redirect to 'find', user:`, params.user ? params.user.uid : 'no user found');

      return this.find({
        ...params,
        findAll: true,
        query: {
          limit: 20,
          filters: [
            {
              type: 'uid',
              q: uids,
            },
          ],
        },
      }).then(res => res.data);
    } if (uids.length > 20) {
      return [];
    }

    debug(`[get:${id}] with auth params:`, params.user ? params.user.uid : 'no user found');
    const fl = Article.ARTICLE_SOLR_FL_LIST_ITEM.concat([
      'lb_plain:[json]',
      'rb_plain:[json]',
      'pp_plain:[json]',
      'nem_offset_plain:[json]',
      // [RK] Note: The content fields below are missing in
      // `ARTICLE_SOLR_FL_LIST_ITEM`. They may not be needed in 'find' endpoint
      // but are certainly needed here.
      'content_txt_fr',
      'content_txt_en',
      'content_txt_de',
    ]);

    return Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      measureTime(() => this.SolrService.get(id, {
        fl,
      }), 'articles.get.solr.articles'),

      // get the newspaper and the version,
      measureTime(() => this.SequelizeService.get(id, {
        scope: 'get',
        where: {
          uid: id,
        },
      }).catch(() => {
        debug(`[get:${id}]: SequelizeService warning, no data found for ${id} ...`);
      }), 'articles.get.db.articles'),
      measureTime(() => Issue.sequelize(this.app.get('sequelizeClient'))
        .findOne({
          attributes: [
            'accessRights',
          ],
          where: {
            uid: id.split(/-i\d{4}/).shift(),
          },
        }), 'articles.get.db.issue'),
    ]).then(([article, addons, issue]) => {
      if (addons) {
        if (issue) {
          article.issue.accessRights = issue.accessRights;
        }
        article.pages = addons.pages.map(d => d.toJSON());
        article.v = addons.v;
      }
      article.assignIIIF();
      return article;
    }).catch((err) => {
      console.error(err);
      throw new NotFound();
    });
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
