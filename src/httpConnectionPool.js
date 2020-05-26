// @ts-check
const { default: fetch } = require('node-fetch');
const genericPool = require('generic-pool');

const factory = {
  async create() {
    return fetch;
  },
  async destroy() { /* nothing to destroy */ },
};


function initHttpPool({ maxParallelConnections = 20, acquireTimeoutSec = 30 } = {}) {
  const opts = {
    max: maxParallelConnections,
    acquireTimeoutMillis: acquireTimeoutSec * 1000,
  };
  return genericPool.createPool(factory, opts);
}

module.exports = {
  initHttpPool,
};
