/**
 *
 */
class Suggestion {
  constructor({
    // the text for the search query, cleaned. E.g, Suiss
    q = '',
    // the query, with the matching part highlighted with html like SOLR.
    // E.g., "<b>Suis</b>se"
    h = '',
    // a shipped item, e.g. the NamedEntity for Suisse. Can be null
    item = null,
    // item content type if any item is present; otherwise
    type = '',

    context = 'include',
    precision = 'normal',
  } = {}) {
    this.q = String(q);
    this.h = String(h);
    if (item) {
      this.item = item;
    }
    this.type = String(type);
    this.context = String(context);
    this.precision = String(precision);
  }
}

module.exports = Suggestion;
