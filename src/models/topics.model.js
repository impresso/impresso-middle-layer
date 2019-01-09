const lodash = require('lodash');

class TopicWord {
  constructor({
    w = '',
    p = 0.0,
  } = {}, {
    checkHighlight = false,
  } = {}) {
    this.w = String(w);
    this.p = parseFloat(p);
    if (checkHighlight) {
      this.h = this.w.split(/<[^>]*>/).length > 2;
    }
  }

  static create(pipe) {
    const parts = pipe.split('|');
    return new TopicWord({
      w: parts.shift(),
      p: parts.length ? parts[0] : 0,
    });
  }
}


class Topic {
  constructor({
    uid = '',
    language = '',
    model = '',
    // array of topicWords
    words = [],
  } = {}, {
    // options
    wordsInExcerpt = 5,
    checkHighlight = false,
  } = {}) {
    this.uid = String(uid);
    this.language = String(language);
    this.words = words;
    this.model = String(model);
    if (checkHighlight) {
      // get highlighted word
      const idx = lodash.findIndex(this.words, 'h');
      if (idx > wordsInExcerpt - 1) {
        this.excerpt = lodash.take(this.words, wordsInExcerpt - 1).concat(['...', this.words[idx]]);
      } else {
        this.excerpt = lodash.take(this.words, wordsInExcerpt);
      }
    } else {
      this.excerpt = lodash.take(this.words, wordsInExcerpt);
    }
  }
  getExcerpt() {
    return this.excerpt.map(d => d.w || d);
  }

  static solrFactory() {
    return topic => new Topic({
      uid: topic.id,
      language: topic.lg_s,
      words: topic.word_probs_dpf.split(' ').map(d => TopicWord.create(d)),
      model: topic.tp_model_s,
    });
  }

  static solrSuggestFactory() {
    const opts = {
      checkHighlight: true,
    };

    return sug => new Topic({
      uid: sug.payload,
      language: sug.payload.split('_').pop(),
      words: sug.term.split(' ').map(w => new TopicWord({
        w,
      }, opts)),
    }, opts);
  }
}

const SOLR_FL = [
  'id',
  'lg_s',
  'word_probs_dpf',
  'tp_model_s',
];


module.exports = Topic;
module.exports.SOLR_FL = SOLR_FL;
