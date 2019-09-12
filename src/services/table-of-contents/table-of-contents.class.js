/* eslint-disable no-unused-vars */
const Newspaper = require('../../models/newspapers.model');
const { BaseArticle } = require('../../models/articles.model');
const SearchFacet = require('../../models/search-facets.model');

class Service {
  constructor({ app, name }) {
    this.app = app;
    this.name = name;
  }

  async get(id, params) {
    const newspaper = new Newspaper({
      uid: id.split('-').shift(),
    });
    const highlightProps = {
      'hl.snippets': 0,
      'hl.alternateField': 'content_txt_fr',
      'hl.maxAlternateFieldLength': 120,
      'hl.fragsize': 0,
    };
    const languages = newspaper.languages;

    if (languages.length === 1) {
      highlightProps['hl.alternateField'] = `content_txt_${languages[0]}`;
    }
    // get all articles for the give issue,
    // at least 1 of content length, max 500 articles
    const result = await this.app.get('solrClient').findAll({
      q: `meta_issue_id_s:${id} AND filter(content_length_i:[1 TO *])`,
      facets: JSON.stringify({
        person: {
          type: 'terms',
          field: 'pers_entities_dpfs',
          mincount: 1,
          limit: 5,
          offset: 0,
          numBuckets: true,
        },
        location: {
          type: 'terms',
          field: 'loc_entities_dpfs',
          mincount: 1,
          limit: 5,
          offset: 0,
          numBuckets: true,
        },
      }),
      limit: 500,
      skip: 0,
      order_by: 'id ASC',
      highlight_by: 'nd',
      highlightProps,
      fl: 'id,content_length_i,cc_b,lg_s,page_id_ss,item_type_s,title_txt_fr,title_txt_de,title_txt_en,pers_entities_dpfs,loc_entities_dpfs,ucoll_ss',
    }, BaseArticle.solrFactory);
    // get persons and locations from the facet,
    // using the simplified version of their buckets
    const [persons, locations] = ['person', 'location'].map((type) => {
      const t = new SearchFacet({
        type,
        ...result.facets[type],
        noBuckets: true,
      });
      return t.getItems();
    });
    // return a TOC instance without instantiating a class.
    return {
      newspaper,
      persons,
      locations,
      articles: result.response.docs,
      countArticles: result.response.numFound,
      info: {
        fragments: result.fragments,
        responseTime: {
          solr: result.responseHeader.QTime,
        },
      },
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
