/* eslint global-require: "off" */
/* eslint import/no-dynamic-require: "off" */
const debug = require('debug')('impresso/data');

class DataIndex {
  constructor({
    name = '',
  } = {}) {
    this.name = String(name);
    debug('init index for', this.name);
    try {
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
