import * as path from 'path'
import { fileURLToPath } from 'url'
import Debug from 'debug'
const debug = Debug('impresso/services:FusionService')
import decypher from 'decypher'
import { NotFound } from '@feathersjs/errors'
import neo4j from '@/neo4j.js'
import sequelize from '@/sequelize.ts'

import { neo4jRun, neo4jRecordMapper, neo4jSummary } from './neo4j.utils'

class FusionService {
  constructor(options) {
    this.neo4j = neo4j.client(options.app.get('neo4j'))
    this.sequelize = sequelize.client(options.app.get('sequelize'))
    // then solr when is ready.
    this.neo4jQueries = decypher(`${__dirname}/${options.name}/${options.name}.queries.cyp`)

    const modelKlass = `../models/${options.name}.model`

    this.Klass = require(modelKlass)
    this.sequelizeKlass = this.Klass.sequelize(this.sequelize)

    this.name = options.name
    debug(`Configuring service: ${options.name}`)
  }

  async get(id) {
    // neo4j
    // get newspaper, purely.
    const itemFromSequelize = await this.sequelizeKlass.scope('get').findById(id)

    if (!itemFromSequelize) {
      debug(`get '${this.name}': uid not found <uid>:`, id)
      throw new NotFound()
    }
    const session = this.neo4j.session()

    // TODO: replace with neo4jService.get ...
    const itemFromNeo4j = await neo4jRun(session, this.neo4jQueries.get, {
      Project: 'impresso',
      uid: itemFromSequelize.uid,
    }).then(res => {
      debug(`get '${this.name}': neo4j success`, neo4jSummary(res))
      if (!Array.isArray(res.records) || !res.records.length) {
        throw new NotFound()
      }
      return neo4jRecordMapper(res.records[0])
    })

    // put the two together
    return {
      ...itemFromSequelize.toJSON(),
      ...itemFromNeo4j,
    }
  }

  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query)
    const session = this.neo4j.session()
    // pure findAll, limit and offset only
    const itemsFromSequelize = await this.sequelizeKlass.scope('findAll').findAll({
      offset: params.query.offset,
      limit: params.query.limit,
    })

    // console.log(itemsFromSequelize.map(d => d.dataValues));
    // enrich with network data
    const itemsFromNeo4j = await neo4jRun(session, this.neo4jQueries.findAll, {
      Project: 'impresso',
      uids: itemsFromSequelize.map(d => d.uid),
    }).then(res => {
      const _records = {}
      debug(`find '${this.name}': neo4j success`, neo4jSummary(res))
      res.records.forEach(rec => {
        _records[rec.uid] = neo4jRecordMapper(rec)
      })
      return _records
    })

    // merge result magically.
    const results = itemsFromSequelize.map(d => ({
      ...itemsFromNeo4j[d.uid],
      ...d.toJSON(),
    }))

    return FusionService.wrap(results, params.query.limit, params.query.offset, 0)
  }

  static wrap(data, limit, skip, total, info) {
    return {
      data,
      limit,
      skip,
      total,
      info,
    }
  }
}

export default function (options) {
  return new FusionService(options)
}

export const Service = FusionService
