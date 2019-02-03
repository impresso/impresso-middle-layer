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
  }
}


module.exports = Timeline;
