/* eslint-disable no-unused-vars */
const { NotFound } = require('@feathersjs/errors');
const debug = require('debug')('impresso/services:images');
const SolrService = require('../solr.service');
const Image = require('../../models/images.model');
const Page = require('../../models/pages.model');


class Service {
  constructor({
    app = null,
    name = '',
  }) {
    this.app = app;
    this.name = name;
    this.sequelizeClient = this.app.get('sequelizeClient');
    this.SolrService = SolrService({
      app,
      name,
      namespace: 'images',
    });
  }

  async assignIIIF({ method, result }) {
    const pagesIndex = {};
    // get page uids for the given images, so that we can get the correct
    // IIIF from mysql db
    if (method === 'get') {
      for (let i = 0, l = result.pages.length; i < l; i += 1) {
        const pageuid = result.pages[i].uid;
        pagesIndex[pageuid].push([-1, i]);
      }
    } else if (method === 'find') {
      for (let i = 0, l = result.data.length; i < l; i += 1) {
        for (let ii = 0, ll = result.data[i].pages.length; ii < ll; ii += 1) {
          const pageuid = result.data[i].pages[ii].uid;
          if (!pagesIndex[pageuid]) {
            pagesIndex[pageuid] = [];
          }
          pagesIndex[pageuid].push([i, ii]);
        }
      }
    }
    const uids = Object.keys(pagesIndex);
    // load page stuff
    const pages = await Page.sequelize(this.sequelizeClient).findAll({
      where: {
        uid: uids,
      },
    });
    // missing pages ...!
    if (!pages.length || pages.length !== uids.length) {
      debug('assignIIIF: cannot find some pages, requested:', uids, 'found:', pages);
    }

    // remap results with objects
    pages.forEach((page) => {
      pagesIndex[page.uid].forEach((coord) => {
        if (method === 'get') {
          result.pages[coord[1]] = page.toJSON();
        } else if (method === 'find') {
          result.data[coord[0]].pages[coord[1]] = page.toJSON();
          result.data[coord[0]].assignIIIF();
        }
      });
    });
    return result;
  }

  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);
    let signature;

    if (params.query.similarTo) {
      debug('get similarTo vector ...', params.query.similarTo);
      signature = await this.SolrService.solr.findAll({
        q: `id:${params.query.similarTo}`,
        fl: ['id', `signature:_vector_${params.query.vectorType}_bv`],
        namespace: 'images',
        limit: 1,
      })
        .then(res => res.response.docs[0].signature)
        .catch((err) => {
          throw new NotFound();
        });

      if (!signature) {
        throw new NotFound('signature not found');
      }
    } else if (params.query.similarToUploaded) {
      debug('get user uploaded image signature for UploadedImage:', params.query.similarToUploaded);
      signature = await this.app.service('uploaded-images')
        .get(params.query.similarToUploaded)
        .then(res => res.signature)
        .catch((err) => {
          throw new NotFound();
        });
    }

    if (signature) {
      let fq;
      if (params.query.sq === '*:*') {
        fq = `_vector_${params.query.vectorType}_bv:[* TO *]`;
      } else {
        fq = `${params.query.sq} AND _vector_${params.query.vectorType}_bv:[* TO *]`;
      }
      return this.SolrService.solr.findAll({
        fq,
        form: {
          q: `{!vectorscoring f="_vector_${params.query.vectorType}_bv" vector_b64="${signature}"}`,
        },
        fl: '*,score',
        namespace: 'images',
        limit: params.query.limit,
        skip: params.query.skip,
        facets: params.query.facets,
        order_by: 'score DESC',
      }, Image.solrFactory).then(res => this.SolrService.solr.utils.wrapAll(res));
    }

    // no signature. Filter out images without signature!
    if (params.query.sq === '*:*') {
      params.query.sq = `filter(_vector_${params.query.vectorType}_bv:[* TO *])`;
    } else {
      params.query.sq = `${params.query.sq} AND filter(_vector_${params.query.vectorType}_bv:[* TO *])`;
    }
    // get all pages, then get IIIF manifest
    return this.SolrService.find({
      ...params,
      fl: Image.SOLR_FL,
    }).then(result => this.assignIIIF({
      method: 'find',
      result,
    }));
  }


  async get(id, params) {
    debug(`get '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);
    return this.SolrService.get(id, {
      fl: Image.SOLR_FL,
    });
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)));
    }

    return data;
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    return data;
  }

  async remove(id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
