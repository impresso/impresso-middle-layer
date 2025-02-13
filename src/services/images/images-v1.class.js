/**
 * @deprecated This file will be removed once we switch to the new Solr.
 */

/* eslint-disable no-unused-vars */
import { asFindAll, asGet } from '../../util/solr/adapters'
import { logger } from '../../logger'
const { NotFound, BadGateway } = require('@feathersjs/errors')
const debug = require('debug')('impresso/services:images')
const Image = require('../../models/images.model')
const Page = require('../../models/pages.model')
const { getFacetsFromSolrResponse } = require('../search/search.extractors')
const { measureTime } = require('../../util/instruments')
const {
  utils: { wrapAll },
  SolrNamespaces,
} = require('../../solr')

export default class Service {
  constructor({ app, name = '' }) {
    this.app = app
    this.name = name
    this.sequelizeClient = this.app.get('sequelizeClient')
  }

  get solr() {
    return this.app.service('simpleSolrClient')
  }

  async assignIIIF({ method, result }) {
    const pagesIndex = {}
    // get page uids for the given images, so that we can get the correct
    // IIIF from mysql db
    if (method === 'get') {
      for (let i = 0, l = result.pages.length; i < l; i += 1) {
        const pageuid = result.pages[i].uid
        pagesIndex[pageuid] = [[-1, i]]
      }
    } else if (method === 'find') {
      for (let i = 0, l = result.data.length; i < l; i += 1) {
        for (let ii = 0, ll = result.data[i].pages.length; ii < ll; ii += 1) {
          const pageuid = result.data[i].pages[ii].uid
          if (!pagesIndex[pageuid]) {
            pagesIndex[pageuid] = []
          }
          pagesIndex[pageuid].push([i, ii])
        }
      }
    }
    const uids = Object.keys(pagesIndex)
    // load page stuff
    const pages = await measureTime(
      () =>
        Page.sequelize(this.sequelizeClient)
          .scope('withAccessRights')
          .findAll({
            where: {
              uid: uids,
            },
          }),
      'images.find.db.pages_iiif'
    )
    // missing pages ...!
    if (!pages.length || pages.length !== uids.length) {
      debug('assignIIIF: cannot find some pages, requested:', uids, 'found:', pages)
    }

    // remap results with objects
    // load access rights from Page Model
    pages.forEach(page => {
      pagesIndex[page.uid].forEach(coord => {
        if (method === 'get') {
          result.pages[coord[1]] = page.toJSON()
          result.assignIIIF()
          result.issue.accessRights = page.accessRights
        } else if (method === 'find') {
          result.data[coord[0]].pages[coord[1]] = page.toJSON()
          result.data[coord[0]].issue.accessRights = page.accessRights
          result.data[coord[0]].assignIIIF()
        }
      })
    })
    return result
  }

  async find(params) {
    debug(`[find] with params.isSafe:${params.isSafe} and params.query:`, params.query)
    let signature
    if (params.query.similar_to_image_id) {
      debug(
        '[find] get signature for params.query.similarTo:',
        params.query.similar_to_image_id,
        '- vector:',
        `_vector_${params.query.vectorType}_bv`
      )
      const request = {
        q: `id:${params.query.similar_to_image_id}`,
        fl: ['id', `signature:_vector_${params.query.vectorType}_bv`],
        namespace: 'images',
        limit: 1,
        requestOriginalPath: 'images/find',
      }
      signature = await measureTime(
        () =>
          asFindAll(this.solr, 'images', request)
            .then(res => res.response.docs[0].signature)
            .catch(err => {
              logger.error(err)
              throw new NotFound()
            }),
        'images.find.solr.image_signatures'
      )
      if (!signature) {
        debug('[find] signature NOT retrieved for params.query.similarTo:', params.query.similar_to_image_id)
        throw new NotFound('signature not found')
      } else {
        debug('[find] signature retrieved for params.query.similarTo:', params.query.similar_to_image_id)
      }
    } else if (params.query.similarToUploaded) {
      debug(
        '[find] get signature for user uploaded image params.query.similarToUploaded:',
        params.query.similarToUploaded
      )
      signature = await this.app
        .service('uploaded-images')
        .get(params.query.similarToUploaded)
        .then(res => res.signature)
        .catch(err => {
          delete err.stack
          throw new NotFound()
        })
    }

    let solrResponse
    let offset = params.query.offset

    if (signature) {
      let fq
      if (params.query.sq === '*:*') {
        fq = `_vector_${params.query.vectorType}_bv:[* TO *]`
      } else {
        fq = `${params.query.sq} AND _vector_${params.query.vectorType}_bv:[* TO *]`
      }
      debug('[find] find all with the current signature, solr query', fq)

      const request = {
        fq,
        form: {
          q: `{!vectorscoring f="_vector_${params.query.vectorType}_bv" vector_b64="${signature}"}`,
        },
        fl: '*,score',
        namespace: 'images',
        limit: params.query.limit,
        offset,
        facets: params.query.facets,
        order_by: 'score DESC',
        requestOriginalPath: 'images/find',
      }
      solrResponse = await measureTime(
        () =>
          asFindAll(this.solr, 'images', request, Image.solrFactory).catch(err => {
            logger.error(err)
            throw new BadGateway('unable to load similar images')
          }),
        'images.find.solr.signature_similar_images'
      )
    } else {
      debug('[find] no signature requested, perform normal solr query')
      // no signature. Filter out images without signature!
      if (params.query.sq === '*:*') {
        params.query.sq = `filter(_vector_${params.query.vectorType}_bv:[* TO *])`
      } else {
        params.query.sq = `${params.query.sq} AND filter(_vector_${params.query.vectorType}_bv:[* TO *])`
      }

      if (params.query.randomPage) {
        // calculate a possible random offset value
        const request = {
          q: params.query.sq,
          limit: 0,
          offset: 0,
          requestOriginalPath: 'images/find',
        }

        offset = await measureTime(
          () =>
            asFindAll(this.solr, SolrNamespaces.Images, request)
              .then(res => res.response.numFound)
              .then(total => {
                const pages = Math.ceil(total / params.query.limit)
                const page = Math.round(Math.random() * pages)
                return Math.max(0, (page - 1) * params.query.limit)
              }),
          'images.find.solr.random_images_skip'
        )
        //
        //   Math.round(
        //   Math.random * Math.floor(res.response.numFound / params.query.limit),
        // ));

        debug('[find] random page requested, recalculating offset:', offset)
      }

      // get all pages, then get IIIF manifest
      // solrResponse = await measureTime(
      //   () =>
      //     this.SolrService.solr
      //       .findAll(
      //         {
      //           q: params.query.sq,
      //           fl: Image.SOLR_FL,
      //           namespace: 'images',
      //           limit: params.query.limit,
      //           offset,
      //           facets: params.query.facets,
      //           order_by: params.query.order_by,
      //           requestOriginalPath: 'images/find',
      //         },
      //         Image.solrFactory
      //       )
      //       .catch(err => {
      //         console.error(err)
      //         throw new BadGateway('unable to load similar images')
      //       }),
      //   'images.find.solr.images'
      // )
      solrResponse = await asFindAll(
        this.solr,
        'images',
        {
          q: params.query.sq,
          fl: Image.SOLR_FL,
          namespace: 'images',
          limit: params.query.limit,
          offset,
          facets: params.query.facets,
          order_by: params.query.order_by,
          requestOriginalPath: 'images/find',
        },
        Image.solrFactory
      ).catch(err => {
        logger.error(err)
        throw new BadGateway('unable to load similar images')
      })
    }

    debug(
      `[find] success, ${solrResponse.response.numFound} results all with the current signature, in QTime:${solrResponse.responseHeader.QTime}ms`
    )

    const facets = await getFacetsFromSolrResponse(solrResponse, this.app)

    return this.assignIIIF({
      method: 'find',
      result: wrapAll({ ...solrResponse, facets }),
    })
  }

  async get(id, params) {
    debug(`get '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query)
    return measureTime(
      () =>
        asGet(this.solr, 'images', id, { fl: Image.SOLR_FL }, Image.solrFactory).then(result =>
          this.assignIIIF({
            method: 'get',
            result,
          })
        ),
      'images.get.solr.image'
    )
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)))
    }

    return data
  }

  async update(id, data, params) {
    return data
  }

  async patch(id, data, params) {
    return data
  }

  async remove(id, params) {
    return { id }
  }
}
