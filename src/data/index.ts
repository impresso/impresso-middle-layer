import YAML from 'yaml'
import { getLogger } from '@/logger.js'
import { readFileSync } from 'fs'
import { StatsConfiguration } from '@/models/generated/app/configuration.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const logger = getLogger(['impresso', 'data'])

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const statsConfiguration: StatsConfiguration = YAML.parse(readFileSync(`${__dirname}/stats.yml`).toString())

export class DataIndex {
  name: string
  values: Record<string, any> | undefined

  constructor({ name = '' } = {}) {
    this.name = String(name)
    logger.debug(`init index for ${this.name}`)
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      this.values = require(`../../data/${this.name}.json`)
      logger.debug(`init index for ${this.name} success`)
    } catch (e) {
      logger.debug(`index built FAILED for ${this.name} ${(e as { code: string }).code}`)
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
