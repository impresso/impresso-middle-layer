// @ts-check
const debug = require('debug')('impresso/data');
const YAML = require('yaml');
const { readFileSync } = require('fs');

class DataIndex {
  constructor({
    name = '',
  } = {}) {
    this.name = String(name);
    debug('init index for', this.name);
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      this.values = require(`../../data/${this.name}.json`);
      debug('init index for', this.name, 'success');
    } catch (e) {
      debug('index built FAILED for', this.name, e.code);
    }
  }

  getValue(key) {
    if (this.values) {
      return this.values[key];
    }
    return undefined;
  }
}

module.exports = function (name) {
  return new DataIndex({
    name,
  });
};

module.exports.DataIndex = DataIndex;
module.exports.statsConfiguration = YAML.parse(readFileSync(`${__dirname}/stats.yml`).toString())
