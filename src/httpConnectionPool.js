// @ts-check
const { default: fetch } = require('node-fetch');
const genericPool = require('generic-pool');

/**
 * Using a class to return by pool instead of a function
 * because functions are sometimes not recognised by the pool.
 */
class ConnectionWrapper {
  /**
   * @param {import('node-fetch').RequestInfo} url
   * @param {import('node-fetch').RequestInit} init
   * @returns {Promise<import('node-fetch').Response>}
   */
  async fetch(url, init = undefined) { return fetch(url, init); }
}

const factory = {
  async create() {
    return new ConnectionWrapper();
  },
  async destroy() { /* nothing to destroy */ },
};


function initHttpPool({ maxParallelConnections = 20, acquireTimeoutSec = 30 } = {}) {
  const opts = {
    min: maxParallelConnections,
    max: maxParallelConnections,
    acquireTimeoutMillis: acquireTimeoutSec * 1000,
  };
  return genericPool.createPool(factory, opts);
}

module.exports = {
  initHttpPool,
};

exports.ConnectionWrapper = ConnectionWrapper;
