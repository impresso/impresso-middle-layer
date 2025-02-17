/* eslint-disable no-unused-vars */
const shash = require('short-hash')
const debug = require('debug')('impresso/services:articles-tags')
const Neo4jService = require('../neo4j.service').Service

/**
 * @deprecated
 */
class Service extends Neo4jService {
  async find(params) {
    return []
  }

  async get(id, params) {
    return {
      id,
      text: `A new message with ID: ${id}!`,
    }
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)))
    }

    return data
  }

  async update(id, data, params) {
    return data
  }

  async patch(id, data, params) {
    return data
  }

  async remove(id, params) {
    return { id }
  }
}

module.exports = function (options) {
  return new Service(options)
}

module.exports.Service = Service
