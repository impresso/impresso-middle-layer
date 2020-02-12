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
    .then(JSON.parse)
    .then(({ version }) => version)
    .catch(() => 'N/A');
}

module.exports = {
  getGitBranch,
  getGitRevision,
  getVersion,
};
