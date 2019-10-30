const yearsIndex = require('../data')('years');

class Weights {
  constructor({
    // number of articles
    a,
    // number of pages
    p,
    // number of issues
    i,
    // number of images (with or without vectors),
    m,
  } = {}) {
    if (typeof a !== 'undefined') {
      this.a = parseFloat(a);
    }
    if (typeof p !== 'undefined') {
      this.p = parseFloat(p);
    }
    if (typeof i !== 'undefined') {
      this.i = parseFloat(i);
    }
    if (typeof m !== 'undefined') {
      this.m = parseFloat(m);
    }
  }
}

class Year {
  constructor({
    y,
    values = null,
    refs = null,
  } = {}) {
    this.y = parseInt(y, 10);
    // values
    if (values) {
      this.values = values instanceof Weights ? values : new Weights(values);
    }
    // reference values to calculate percentage
    if (refs) {
      this.refs = refs instanceof Weights ? refs : new Weights(refs);
    }

    if (refs && values) {
      this.norm = this.normalize();
    }
  }

  /**
   * Normalize values against a specific weight
   * @return {Weights} new Weights instances with normalized values
   */
  normalize() {
    const normalized = new Weights();
    Object.keys(this.values).forEach((k) => {
      if (typeof this.refs[k] === 'undefined' || this.refs[k] === 0) {
        normalized[k] = 0;
      } else {
        normalized[k] = this.values[k] / this.refs[k];
      }
    });
    return normalized;
  }

  static getCached(y) {
    return new Year(yearsIndex.getValue(y));
  }
}

module.exports = Year;
