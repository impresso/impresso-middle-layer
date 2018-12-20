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
      if (pageUids.length === 1) {
        fl = Article.ARTICLE_SOLR_FL;
      }
    }
    // if(params.isSafe query.filters)
    const results = await this.SolrService.find({
      ...params,
      fl,
    });

    // go out if there's nothing to do.
    if (results.total === 0) {
      return results;
    }

    // add collections and other stuff from sequelize
    const addons = await this.SequelizeService.find({
      ...params,
      scope: 'get',
      where: {
        uid: { $in: results.data.map(d => d.uid) },
      },
      limit: results.data.length,
      order_by: [['uid', 'DESC']],
    });

    // calculate regions
    if (pageUids.length === 1) {
      results.data = results.data.map((d) => {
        const addon = addons.data.find(a => d.uid === a.uid);
        return {
          ...d,
          newspaper: addon ? addon.newspaper : d.newspaper,
          regions: d.regions
            .filter(r => pageUids.indexOf(r.pageUid) !== -1),
        };
      });
    }

    return results;
  }

  async get(id, params) {
    const uids = id.split(',');
    if (uids.length > 1 && uids.length < 20) {
      const results = await Promise.all(uids.map(d => this.get(d, params)));
      return results;
    } else if (uids.length > 20) {
      return [];
    }
    const where = {
      uid: id,
    };
    debug('articles get:', id, 'user', params.user);
    // if there's an user, get the private ones as well.
    if (params.user) {
      where.$or = [
        { '$collections.creator_id$': params.user.id },
        { '$collections.status$': 'PUB' },
      ];
    } else {
      where['$collections.status$'] = { $in: ['PUB', 'SHA'] };
    }

    const article = await Promise.all([
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
        debug(`get: no data found for ${id} ...`);
      }),
      // then the collections, catch to null;
      this.SequelizeService.get(id, {
        scope: 'getCollections',
        where,
      }).catch(() => {
        debug(`get: no collections found for ${id}`, where);
      }),
    ]).then((results) => {
      if (!results[1]) {
        return results[0];
      }

      let collections = [];

      if (results[2]) {
        collections = results[2].collections;
        debug(`get: ${collections.length} collections found for ${id}`);
      }

      return {
        ...results[0],
        v: results[1].v,
        newspaper: results[1].newspaper,
        collections,
      };
    });

    return article;
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
