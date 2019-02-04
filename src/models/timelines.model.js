const lodash = require('lodash');

class Timeline {
  constructor({
    name = '',
    legend = {
      w: 'count',
    },
    format = '%Y',
    values = [], // {t, w, w1, w2 etc..} where t is formatted according to format
  } = {}) {
    this.name = name;
    this.legend = legend;
    this.format = format;
    this.values = values;
    this.extents = {};
    // calculate extents
    Object.keys(this.legend).forEach((key) => {
      const vals = values.map(d => d[key]);
      this.extents[key] = [
        lodash.min(vals),
        lodash.max(vals),
      ];
    });
  }
}


module.exports = Timeline;
