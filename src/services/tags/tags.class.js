/* eslint-disable no-unused-vars */
import shash from 'short-hash'
import debug from 'debug'
const debugLog = debug('impresso/services:articles-tags')
import { Service as Neo4jService } from '../neo4j.service'

/**
 * @deprecated
 */
export class Service extends Neo4jService {
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

export default function (options) {
  return new Service(options)
}
