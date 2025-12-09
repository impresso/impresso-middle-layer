/**
 *
 */
class Suggestion {
  constructor ({
    // the text for the search query, cleaned. E.g, Suiss
    q = '',
    // the query, with the matching part highlighted with html like SOLR.
    // E.g., "<b>Suis</b>se"
    h = '',
    // a shipped item, e.g. the NamedEntity for Suisse. Can be null
    item = null,
    // item content type if any item is present; otherwise
    type = '',
    weight = -1,
  } = {}) {
    this.q = String(q);
    this.h = String(h);
    if (item) {
      this.item = item;
    }
    this.type = String(type);
    if (weight !== -1) {
      this.weight = parseInt(weight, 10);
    }
  }
}

export default Suggestion;
