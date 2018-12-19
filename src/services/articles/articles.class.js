const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');

const { NotFound } = require('@feathersjs/errors');
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
    const results = await this.solr.findAll({
      q: params.query.sq,
      limit: params.query.limit,
      skip: params.query.skip,
      fl,
      order_by: 'id asc', // default ordering TODO
    }, Article.solrFactory);

    if (results.response.numFound === 0) {
      throw new NotFound();
    }

    const total = results.response.numFound;

    // calculate regions etc...
    if (pageUids.length === 1) {
      // console.log(results.response.docs[0]);
      results.response.docs = results.response.docs.map(d => ({
        ...d,
        regions: d.regions
          .filter(r => pageUids.indexOf(r.pageUid) !== -1),
      }));
    }

    return Service.wrap(
      results.response.docs,
      params.query.limit,
      params.query.skip,
      total, {
        responseTime: {
          solr: results.responseHeader.QTime,
        },
      },
    );
  }

  async get(id, params) {
    const where = {
      uid: id,
    };

    // if there's an user, get the private ones as well.
    if (params.user) {
      where['$collections.creator_id$'] = params.user.id;
    } else {
      where['$collections.status$'] = {
        $in: ['PUB', 'SHA'],
      };
    }

    const article = await Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      this.SolrService.get(id, {
        fl: Article.ARTICLE_SOLR_FL,
      }),

      // get the newspaper, then the collections
      this.SequelizeService.get(id, {
        scope: 'get',
        where,
      }),
      // at the same time, we use the neo4jService get to get article instance from our graph db
      // super.get(id, {
      //   ...params,
      //   findAll,
      // }),
      //

    ]).then(results => ({
      ...results[0],
      v: results[1].v,
      newspaper: results[1].newspaper,
      collections: results[1].collections.filter(d => d.status === 'PUB'),
    }));

    return article;
    // if (results[0].response.numFound !== 1) {
    //   throw new NotFound();
    // }

    // get all related collections
    // this.app

    // expect an array indeed
    // if (uids.length > 1) {
    // return results[0].response.docs;
    // }
    // // enrich with neo4j results
    // return {
    //   ...results[0].response.docs[0],
    //   // add tags
    //   tags: results[1] ? results[1].tags.map(d => new Tag(d)) : [],
    // };

    // // if params findall was true or when multiple ids are given, results[1] is an array.
    // if (Array.isArray(results[1].data) && results[1].data.length) {
    //   return {
    //     ...results[0].response.docs[0],
    //     ...results[1].data[0],
    //   };
    // }
    //
    // return results[0].response.docs[0];
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
