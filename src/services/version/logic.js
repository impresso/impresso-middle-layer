// @ts-check
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const readFile = util.promisify(require('fs').readFile);

const PackageJsonPath = `${__dirname}/../../../package.json`;

const Commands = Object.freeze({
  GetGitBranch: 'git rev-parse --abbrev-ref HEAD',
  GetGitRevision: 'git rev-parse --short HEAD',
});

async function getGitDetail(envVar, command) {
  if (process.env[envVar] != null) return process.env[envVar];
  return exec(command)
    .then(({ stdout }) => stdout.replace(/\n/g, ''))
    .catch(() => 'N/A');
}

async function getGitBranch() {
  return getGitDetail('IMPRESSO_GIT_BRANCH', Commands.GetGitBranch);
}

async function getGitRevision() {
  return getGitDetail('IMPRESSO_GIT_REVISION', Commands.GetGitRevision);
}

async function getVersion() {
  return readFile(PackageJsonPath)
    .then(content => JSON.parse(content.toString()))
    .then(({ version }) => version)
    .catch(() => 'N/A');
}


const getSingleDocumentQuery = isFirstDocument => ({
  q: '*:*',
  rows: 1,
  sort: `meta_date_dt ${isFirstDocument ? 'asc' : 'desc'}`,
});

const searchResponseToDate = response => response.response.docs[0].meta_date_dt;

/**
 * @param {import('../../cachedSolr').CachedSolrClient} solr
 */
async function getFirstAndLastDocumentDates(solr) {
  const results = await Promise.all([
    getSingleDocumentQuery(true),
    getSingleDocumentQuery(false),
  ].map(query => solr.get(query, solr.namespaces.Search, solr.ttl.Long)));
  return results.map(searchResponseToDate);
}

module.exports = {
  getGitBranch,
  getGitRevision,
  getVersion,
  getFirstAndLastDocumentDates,
};
