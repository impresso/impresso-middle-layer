import YAML from 'yaml'
import Debug from 'debug'
import { readFileSync } from 'fs'
import { StatsConfiguration } from '../models/generated/common'

const debug = Debug('impresso/data')

export const statsConfiguration: StatsConfiguration = YAML.parse(readFileSync(`${__dirname}/stats.yml`).toString())

export class DataIndex {
  name: string
  values: Record<string, any> | undefined

  constructor({ name = '' } = {}) {
    this.name = String(name)
    debug('init index for', this.name)
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      this.values = require(`../../data/${this.name}.json`)
      debug('init index for', this.name, 'success')
    } catch (e) {
      debug('index built FAILED for', this.name, (e as { code: string }).code)
    }
  }

  getValue(key: string) {
    if (this.values) {
      return this.values[key]
    }
    return undefined
  }
}

export default function (name: string) {
  return new DataIndex({
    name,
  })
}
