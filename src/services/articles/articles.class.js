const debug = require('debug')('impresso/services:articles');

const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');
const Article = require('../../models/articles.model');

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
    });
    this.SolrService = SolrService({
      app,
      name,
      namespace: 'search',
    });
  }

  async find(params) {
    let fl = Article.ARTICLE_SOLR_FL_LITE;
    let pageUids = [];

    if (params.isSafe) {
      pageUids = params.query.filters
        .filter(d => d.type === 'page')
        .map(d => d.q);
      // As we requested article in a page,
      // we have to calculate regions for that page.
    }

    if (pageUids.length === 1) {
      fl = Article.ARTICLE_SOLR_FL;
    }

    debug(`'find' ${this.name}`, params);
    // if(params.isSafe query.filters)
    const results = await this.SolrService.find({
      ...params,
      fl,
    });

    // go out if there's nothing to do.
    if (results.total === 0) {
      return results;
    }

    // add newspapers and other things from sequelize
    // to be moved to the toBeResolved hook? proper hook.
    const addons = await this.SequelizeService.find({
      ...params,
      scope: 'get',
      where: {
        uid: { $in: results.data.map(d => d.uid) },
      },
      limit: results.data.length,
      order_by: [['uid', 'DESC']],
    });

    results.data = results.data.map((d) => {
      const addon = addons.data.find(a => d.uid === a.uid);
      if (!addon) {
        return d;
      }
      if (pageUids.length === 1) {
        return {
          ...d,
          newspaper: addon.newspaper,
          regions: d.regions
            .filter(r => pageUids.indexOf(r.pageUid) !== -1),
        };
      }
      return {
        ...d,
        newspaper: addon.newspaper,
      };
    });

    return results;
  }

  async get(id, params) {
    const uids = id.split(',');
    if (uids.length > 1 || params.findAll) {
      return this.find({
        params: {
          ...params,
          findAll: true,
        },
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
    } else if (uids.length > 20) {
      return [];
    }

    debug(`'get', id: ${id}`, params.user ? params.user.uid : 'no user found');

    return Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      this.SolrService.get(id, {
        fl: Article.ARTICLE_SOLR_FL,
      }),

      // get the newspaper and the version,
      this.SequelizeService.get(id, {
        scope: 'get',
        where: {
          uid: id,
        },
      }).catch(() => {
        debug(`get: SequelizeService warning, no data found for ${id} ...`);
      }),
    ]).then((results) => {
      if (!results[1]) {
        return results[0];
      }

      return {
        ...results[0],
        v: results[1].v,
        newspaper: results[1].newspaper,
      };
    });
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
