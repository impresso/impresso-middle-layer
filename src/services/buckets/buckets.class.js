import debugLib from 'debug'
const debug = debugLib('impresso/services:buckets')
import slugify from 'slugify'
import lodash from 'lodash-es'
import { NotImplemented } from '@feathersjs/errors'
import { Service as Neo4jService } from '@/services/neo4j.service.js'

/**
 * @deprecated
 */
export class Service extends Neo4jService {
  async create(data, params) {
    if (Array.isArray(data)) {
      throw new NotImplemented()
      // return await Promise.all(data.map(current => this.create(current)));
    }

    const queryParams = {
      ...params.query,

      description: data.sanitized.description,
      name: data.sanitized.name,
      slug: slugify(data.sanitized.name).toLowerCase(),
    }

    // only staff can create buckets with specific uid
    if (params.user.is_staff && data.sanitized.bucket_uid) {
      debug(`create: staff user required bucket uid: "${data.sanitized.bucket_uid}"`)
      queryParams.bucket_uid = data.sanitized.bucket_uid
    }

    debug(`${this.name} create: `, queryParams)
    return this._run(this.queries.create, queryParams).then(this._finalizeCreateOne)
  }

  /**
   * async patch - description
   *
   * @param  {string} id    uid
   * @param  {object} data   description and name if any to be changed.
   * @param  {type} params description
   * @return {type}        description
   */
  async patch(id, data, params) {
    const result = await this._run(this.queries.patch, {
      user__uid: params.query.user__uid,
      uid: id,
      description: data.sanitized.description,
      name: data.sanitized.name,
    })

    return this._finalizeCreateOne(result)
  }

  async get(id, params) {
    const results = await super.get(id, params)

    const groups = {
      article: {
        service: 'articles',
        uids: [],
      },
      page: {
        service: 'pages',
        uids: [],
      },
      issue: {
        service: 'issues',
        uids: [],
      },
    }
    // collect items uids
    results.items.forEach(d => {
      // add uid to list of uid per service.
      groups[d.labels[0]].uids.push(d.uid)
    })

    debug(`${this.name} get:users`, params.user)
    // if articles
    return Promise.all(
      lodash(groups)
        .filter(d => d.uids.length)
        .map(d =>
          this.app.service(d.service).get(d.uids.join(','), {
            query: {},
            user: params.user,
            findAll: true,
          })
        )
        .value()
    ).then(values => {
      const flattened = lodash(values).flatten().keyBy('uid').value()
      // enrich
      results.items = results.items.map(d => ({
        ...d,
        ...flattened[d.uid],
      }))
      return results
    })
  }
}

export default function (options) {
  return new Service(options)
}
