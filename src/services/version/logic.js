const util = require('util')
const exec = util.promisify(require('child_process').exec)
const readFile = util.promisify(require('fs').readFile)
const newspapersIndex = require('../../data')('newspapers')

const PackageJsonPath = `${__dirname}/../../../package.json`

const Commands = Object.freeze({
  GetGitBranch: 'git rev-parse --abbrev-ref HEAD',
  GetGitRevision: 'git rev-parse --short HEAD',
})

async function getGitDetail(envVar, command) {
  if (process.env[envVar] != null) return process.env[envVar]
  return exec(command)
    .then(({ stdout }) => stdout.replace(/\n/g, ''))
    .catch(() => 'N/A')
}

async function getGitBranch() {
  return getGitDetail('IMPRESSO_GIT_BRANCH', Commands.GetGitBranch)
}

async function getGitRevision() {
  return getGitDetail('IMPRESSO_GIT_REVISION', Commands.GetGitRevision)
}

async function getVersion() {
  return readFile(PackageJsonPath)
    .then(content => JSON.parse(content.toString()))
    .then(({ version }) => version)
    .catch(() => 'N/A')
}

const getSingleDocumentQuery = isFirstDocument => ({
  query: '*:*',
  limit: 1,
  sort: `meta_date_dt ${isFirstDocument ? 'asc' : 'desc'}`,
})

const searchResponseToDate = doc => doc.meta_date_dt

/**
 * @param {import('../../internalServices/simpleSolr').SimpleSolrClient} solr
 */
async function getFirstAndLastDocumentDates(solr) {
  const results = await Promise.all(
    [getSingleDocumentQuery(true), getSingleDocumentQuery(false)].map(query =>
      solr.selectOne(solr.namespaces.Search, { body: query })
    )
  )
  return results.map(searchResponseToDate)
}

async function getNewspaperIndex() {
  return Object.values(newspapersIndex.values).reduce((index, newspaper) => {
    index[newspaper.uid] = {
      name: newspaper.name,
    }
    return index
  }, {})
}

module.exports = {
  getGitBranch,
  getGitRevision,
  getVersion,
  getFirstAndLastDocumentDates,
  getNewspaperIndex,
}
