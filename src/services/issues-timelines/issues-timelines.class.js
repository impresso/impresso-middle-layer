/* eslint-disable no-unused-vars */
import { NotFound } from '@feathersjs/errors'
import Timeline from '../../models/timelines.model'
import { sequelizeErrorHandler, whereReducer } from '../sequelize.utils.js'
import { measureTime } from '../../util/instruments'

export class Service {
  constructor({ name = '', app }) {
    this.name = name
    this.app = app
    this.sequelize = this.app.get('sequelizeClient')
  }

  async stats(where) {
    const whereClause = where
      .concat([{ 'issues.is_damaged': 1 }])
      .reduce(whereReducer, [])
      .join(' AND ')
    const queries = [
      `SELECT issues.year AS t, COUNT(issues.id) AS w
       FROM issues
       ${where.length ? `WHERE ${where.reduce(whereReducer, []).join(' AND ')}` : ''}
       GROUP BY issues.year`,
      `SELECT issues.year AS t, COUNT(issues.id) AS w
       FROM issues
       WHERE ${whereClause}
       GROUP BY issues.year`,
    ]

    return measureTime(
      () =>
        Promise.all(
          queries.map(query =>
            this.sequelize.query(query, {
              type: this.sequelize.QueryTypes.SELECT,
            })
          )
        ).then(
          results =>
            new Timeline({
              service: this.name,
              name: 'stats',
              legend: {
                w: 'total',
                w1: 'damaged',
              },
              total: results[0].length,
              values: results[0].map(d => {
                // combine results in the same timeline, using the global (first)
                ;[1].forEach(k => {
                  for (let i = 0, l = results[k].length; i < l; i += 1) {
                    if (results[k][i].t === d.t) {
                      d[`w${k}`] = results[1][i].w
                      break
                    }
                  }
                  if (!d[`w${k}`]) {
                    d[`w${k}`] = 0
                  }
                })

                return d
              }),
            })
        ),
      'issues-timelines.get.db.timelines'
    )
  }

  async get(id, params) {
    // simplified where for sequelize raw queries.
    const where = []

    if (params.sanitized.newspaper_uid) {
      where.push({
        'issues.newspaper_id': params.sanitized.newspaper_uid,
      })
    }

    let result

    if (id === 'stats') {
      result = await this.stats(where)
    }

    if (!result) {
      throw new NotFound()
    }
    return result
  }
}

export default function (options) {
  return new Service(options)
}
