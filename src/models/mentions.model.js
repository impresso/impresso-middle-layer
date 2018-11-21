const MENTION_TYPES = [
  'Person',
  'Location',
];

class Mention {
  constructor({
    name = '',
    frequence = 0,
    type = '',
  } = {}) {
    this.name = String(name);
    this.frequence = parseInt(frequence, 10);
    this.type = MENTION_TYPES.indexOf(type) !== -1 ? type.toLowerCase() : 'mention';
  }

  static solrFactory() {
    return doc => new Mention({
      name: doc.l_s,
      type: doc.t_s,
      frequence: doc.fq_i,
    });
  }
}


module.exports.solrFactory = Mention.solrFactory;
module.exports.Model = Mention;
