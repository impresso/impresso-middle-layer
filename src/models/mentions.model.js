const MENTION_TYPES = [
  'Person',
  'Location',
];

class Mention {
  constructor ({
    name = '',
    frequence = 0,
    type = '',
  } = {}) {
    this.name = String(name);
    this.frequence = parseInt(frequence, 10);
    this.type = MENTION_TYPES.indexOf(type) !== -1 ? type.toLowerCase() : 'mention';
  }

  static solrFactory () {
    return suggestion => new Mention({
      name: suggestion.term,
      type: suggestion.payload,
      frequence: suggestion.weight,
    });
  }
}

export default Mention;
