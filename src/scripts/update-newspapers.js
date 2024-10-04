// import tags from a well defined list of tags
const fs = require('fs')
const lodash = require('lodash')
const debug = require('debug')('impresso/scripts:update-data')
const config = require('@feathersjs/configuration')()()
const sequelizeClient = require('../sequelize').client(config.sequelize)
const solrClient = require('../solr').client(config.solr, config.solrConnectionPool)

const Newspaper = require('../models/newspapers.model')
const Issue = require('../models/issues.model')

debug('start!')

async function waterfall() {
  debug('find newspapers...')

  const newspapers = await Newspaper.sequelize(sequelizeClient)
    .scope('findAll')
    .findAll()
    .then(results => results.map(d => d.toJSON()))
    .then(results => lodash.keyBy(results, 'acronym'))

  debug('found', Object.keys(newspapers).length, 'newspapers in mysql db,')

  // get total pages per newspapers
  await sequelizeClient
    .query(
      `
    SELECT
      COUNT(DISTINCT p.id) as countPages,
      iss.newspaper_id as uid
    FROM pages AS p
    JOIN issues as iss ON p.issue_id=iss.id
    GROUP BY iss.newspaper_id`,
      {
        type: sequelizeClient.QueryTypes.SELECT,
      }
    )
    .then(results => {
      debug('success, ', results.length, 'newspapers WITH PAGES in mysql db found on the db')
      results.forEach(d => {
        newspapers[d.uid].countPages = d.countPages
      })
    })
    .catch(err => {
      console.log(err)
      throw err
    })

  // get (real) articles!
  await solrClient
    .findAll({
      q: 'filter(content_length_i:[1 TO *])',
      limit: 0,
      offset: 0,
      fl: 'id',
      facets: JSON.stringify({
        newspaper: {
          type: 'terms',
          field: 'meta_journal_s',
          mincount: 1,
          limit: 1000,
          numBuckets: true,
        },
      }),
    })
    .then(results => {
      results.facets.newspaper.buckets.forEach(d => {
        if (!newspapers[d.val]) {
          throw new Error('Not found value', d.val)
        }
        newspapers[d.val].countArticles = d.count
      })
    })

  // get firstIssue and lastIssue
  await sequelizeClient
    .query(
      `SELECT n.id as uid, MIN(iss.id) as firstIssue, MAX(iss.id) as lastIssue, COUNT(iss.id) as countIssues
       FROM issues as iss
       JOIN newspapers as n ON n.id = iss.newspaper_id
     GROUP BY n.id`,
      {
        type: sequelizeClient.QueryTypes.SELECT,
      }
    )
    .then(results => {
      results.forEach(d => {
        newspapers[d.uid].firstIssue = new Issue({ uid: d.firstIssue })
        newspapers[d.uid].lastIssue = new Issue({ uid: d.lastIssue })
        newspapers[d.uid].countIssues = d.countIssues
      })
    })
    .catch(err => {
      console.log(err)
    })

  debug('saving', Object.keys(newspapers).length, 'newspapers...')

  const fileName = './data/newspapers.json'
  fs.writeFileSync(fileName, JSON.stringify(newspapers))
  debug(`success, saved ${fileName}`)
  debug('count newspaper issues, pages')
}

waterfall()
  .then(() => {
    debug('done, exit.') // prints 60 after 2 seconds.
    process.exit(0)
  })
  .catch(err => {
    console.log(err)
    process.exit(1)
  })
