/* eslint-disable no-unused-vars */
const { NotFound } = require('@feathersjs/errors')
const Timeline = require('../../models/timelines.model')
const { sequelizeErrorHandler, whereReducer } = require('../sequelize.utils.js')
const { measureTime } = require('../../util/instruments')

class Service {
  constructor({ name = '', app }) {
    this.name = name
    this.app = app
    this.sequelize = this.app.get('sequelizeClient')
  }

  async stats(where) {
    const firstWhereClause = where
      .concat([{ 'pages.n_tokens': 0 }])
      .reduce(whereReducer, [])
      .join(' AND ')
    const secondWhereClause = where
      .concat([{ 'pages.has_corrupted_json': 1 }])
      .reduce(whereReducer, [])
      .join(' AND ')

    const queries = [
      `SELECT issues.year AS t, COUNT(pages.id) AS w
       FROM pages INNER JOIN issues
         ON (pages.issue_id = issues.id)
      ${where.length ? `WHERE ${where.reduce(whereReducer, []).join(' AND ')}` : ''}
       GROUP BY issues.year`,
      `SELECT issues.year AS t, COUNT(pages.id) AS w
       FROM pages INNER JOIN issues
         ON (pages.issue_id = issues.id)
       WHERE ${firstWhereClause}
       GROUP BY issues.year`,
      `SELECT issues.year AS t, COUNT(pages.id) AS w
       FROM pages INNER JOIN issues
         ON (pages.issue_id = issues.id)
       WHERE ${secondWhereClause}
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
              services: 'pages-timelines',
              name: 'pages',
              legend: {
                w: 'total',
                w1: 'empty',
                w2: 'corrupted',
              },
              total: results[0].length,
              values: results[0].map(d => {
                // combine results in the same timeline, using the global (first)
                ;[1, 2].forEach(k => {
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
      'pages-timelines.get.db.pages'
    )
  }

  async get(id, params) {
    // simplified where for sequelize raw queries.
    const where = []

    if (params.sanitized.newspaper_uid) {
      where.push({
        'pages.newspaper_id': params.sanitized.newspaper_uid,
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

export const Service = Service
