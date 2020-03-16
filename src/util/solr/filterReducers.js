const YAML = require('yaml');
const { readFileSync } = require('fs');
const config = require('@feathersjs/configuration')()();

const filtersConfig = YAML.parse(readFileSync(`${__dirname}/solrFilters.yml`).toString());

const escapeValue = value => value.replace(/[()\\+&|!{}[\]?:;,]/g, d => `\\${d}`);

const getValueWithFields = (value, fields) => {
  if (Array.isArray(fields)) {
    return fields.map(field => getValueWithFields(value, field)).join(' OR ');
  }
  return `${fields}:${escapeValue(value)}`;
};

const reduceNumericRangeFilters = (filters, field) => filters
  .reduce((sq, filter) => {
    let q; // q is in the form array ['1 TO 10', '20 TO 30'] (OR condition)
    // or simple string '1 TO X';
    if (Array.isArray(filter.q)) {
      q = `${field}:[${filter.q[0]} TO ${filter.q[1]}]`;
    } else {
      q = `${field}:[${filter.q}]`;
    }
    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT (${q})` : `*:* AND NOT (${q})`;
    }
    sq.push(q);
    return sq;
  }, []).join(' AND ');

const SolrSupportedLanguages = ['en', 'fr', 'de'];

const reduceStringFiltersToSolr = (filters, field) => {
  let fields = [];
  if (typeof field === 'string') fields = [field];
  else if (Array.isArray(field)) fields = field;
  else if (field.prefix != null) fields = SolrSupportedLanguages.map(lang => `${field.prefix}${lang}`);
  else throw new Error(`Unknown type of Solr field: ${JSON.stringify(field)}`);

  // reduce the string in filters to final SOLR query `sq`
  return filters.reduce((sq, filter) => {
    let q = filter.q.trim();

    q = q.replace(/"/g, ' ');
    // const isExact = /^"[^"]+"$/.test(q);
  const hasMultipleWords = q.split(/\s/).length > 1;
  const isExact = q.match(/^"(.*)"(~[12345])?$/);
  const isFuzzy = q.match(/^(.*)~([12345])$/);
  // escape unwanted values
  // console.log(filter);
  // console.log('isExact', isExact);
  // console.log('isFuzzy', isFuzzy);
  if (isExact && isFuzzy) {
    q = `"${fullyEscapeValue(isExact[1])}"${isExact[2]}`;
  } else if (isExact) {
    q = `"${fullyEscapeValue(isExact[1])}"`;
  } else if (isFuzzy) {
    q = `"${fullyEscapeValue(isFuzzy[1])}"`;
  } else {
    // use filter properties if set
    q = fullyEscapeValue(q);
    if (filter.precision === 'soft') {
      q = `(${q.split(/\s+/g).join(' OR ')})`;
    } else if (filter.precision === 'fuzzy') {
      // "richard chase"~1
      q = `"${q.split(/\s+/g).join(' ')}"~1`;
    } else if (filter.precision === 'exact') {
      q = `"${q}"`;
    } else if (hasMultipleWords) {
      // text:"Richard Chase"
      q = `(${q.split(/\s+/g).join(' ')})`;
    }
  }

    const ql = fields.map(f => `${f}:${q}`);
    q = ql.length > 1
      ? `(${ql.join(' OR ')})`
      : ql[0];

    // // q multiplied for languages :(
    // if (languages.length) {
    //   const ql = (filter.langs || languages).map(lang => `${field}_${lang}:${q}`);

    //   if (ql.length > 1) {
    //     q = `(${ql.join(' OR ')})`;
    //   } else {
    //     q = ql[0];
    //   }
    // } else {
    //   q = `${field}:${q}`;
    // }

  if (Array.isArray(filter.q)) {
    qq = filter.q.map(value => getStringQueryWithFields(
      value,
      field,
      filter.langs || languages,
      filter,
    )).join(` ${op} `);
    qq = `(${qq})`;
  } else {
    qq = getStringQueryWithFields(
      filter.q,
      field,
      filter.langs || languages,
      filter,
    );
  }
  if (filter.context === 'exclude') {
    qq = sq.length > 0 ? `NOT (${qq})` : `*:* AND NOT (${qq})`;
  }
  sq.push(qq);
  return sq;
}, []).join(' AND ');
};

const reduceDaterangeFiltersToSolr = filters => filters
  .reduce((sq, filter) => {
    let q;
    if (Array.isArray(filter.q)) {
      q = `${filter.q.map(d => `meta_date_dt:[${d}]`).join(' OR ')}`;
      if (filter.q.length > 1) {
        q = `(${q})`;
      }
    } else {
      q = `meta_date_dt:[${filter.q}]`;
    }
    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT (${q})` : `*:* AND NOT (${q})`;
    }
    sq.push(q);
    return sq;
  }, []).join(' AND ');

const reduceFiltersToSolr = (filters, field) => filters.reduce((sq, filter) => {
  let qq = '';
  const op = filter.op || 'OR';

  if (Array.isArray(filter.q)) {
    qq = filter.q.map(value => getValueWithFields(value, field)).join(` ${op} `);
    qq = `(${qq})`;
  } else {
    qq = getValueWithFields(filter.q, field);
  }
  if (filter.context === 'exclude') {
    qq = sq.length > 0 ? `NOT (${qq})` : `*:* AND NOT (${qq})`;
  }
  sq.push(qq);
  return sq;
}, []).join(' AND ');

const reduceRegexFiltersToSolr = filters => filters.reduce((reduced, query) => {
  // cut regexp at any . not preceded by an escape sign.
  const q = query.q
  // get rid of first / and last /
    .replace(/^\/|\/$/g, '')
  // split on point or spaces
    .split(/\\?\.[*+]/)
  // filterout empty stuff
    .filter(d => d.length)
  // rebuild;
    .map(d => `content_txt_fr:/${d}/`);
  return reduced.concat(q);
}, []).join(' AND ');

const minLengthOneHandler = (filters, field, filterRule) => {
  if (typeof field !== 'string') throw new Error(`"${filterRule}" supports only "string" fields`);
  return `${field}:[1 TO *]`;
};

const booleanHandler = (filters, field, filterRule) => {
  if (typeof field !== 'string') throw new Error(`"${filterRule}" supports only "string" fields`);
  return `${field}:1`;
};

const FiltersHandlers = Object.freeze({
  minLengthOne: minLengthOneHandler,
  numericRange: reduceNumericRangeFilters,
  boolean: booleanHandler,
  string: reduceStringFiltersToSolr,
});

const filtersToSolr = (type, filters, solrNamespace) => {
  const filtersRules = filtersConfig.indexes[solrNamespace]
    ? filtersConfig.indexes[solrNamespace].filters
    : {};
  const filterRules = filtersRules[type];
  if (filterRules == null) throw new Error(`Unknown filter type "${type}" in namespace "${solrNamespace}"`);

  const handler = FiltersHandlers[filterRules.rule];
  if (handler == null) throw new Error(`Could not find handler for rule ${filterRules.rule}`);

  return handler(filters, filterRules.field, filterRules.rule);

  // switch (type) {
  //   case 'hasTextContents':
  //     return config.solr.queries.hasTextContents;
  //   case 'ocrQuality':
  //     return reduceNumericRangeFilters(filters, 'ocrqa_f');
  //   case 'contentLength':
  //     return reduceNumericRangeFilters(filters, 'content_length_i');
  //   case 'isFront':
  //     return 'front_b:1';
  //   case 'string':
  //     return reduceStringFiltersToSolr(filters, 'content_txt');
  //   case 'title':
  //     return reduceStringFiltersToSolr(filters, 'title_txt');
  //   case 'daterange':
  //     return reduceDaterangeFiltersToSolr(filters);
  //   case 'uid':
  //     return reduceFiltersToSolr(filters, 'id');
  //   case 'accessRight':
  //     return reduceFiltersToSolr(filters, 'access_right_s');
  //   case 'partner':
  //     return reduceFiltersToSolr(filters, 'meta_partnerid_s');
  //   case 'language':
  //     return reduceFiltersToSolr(filters, 'lg_s');
  //   case 'page':
  //     return reduceFiltersToSolr(filters, 'page_id_ss');
  //   case 'collection':
  //     return reduceFiltersToSolr(filters, 'ucoll_ss');
  //   case 'issue':
  //     return reduceFiltersToSolr(filters, 'meta_issue_id_s');
  //   case 'newspaper':
  //     return reduceFiltersToSolr(filters, 'meta_journal_s');
  //   case 'topic':
  //     return reduceFiltersToSolr(filters, 'topics_dpfs');
  //   case 'year':
  //     return reduceFiltersToSolr(filters, 'meta_year_i');
  //   case 'type':
  //     return reduceFiltersToSolr(filters, 'item_type_s');
  //   case 'country':
  //     return reduceFiltersToSolr(filters, 'meta_country_code_s');
  //   case 'mention':
  //     return reduceFiltersToSolr(filters, ['pers_mentions', 'loc_mentions']);
  //   case 'entity':
  //     return reduceFiltersToSolr(filters, ['pers_entities_dpfs', 'loc_entities_dpfs']);
  //   case 'person':
  //     return reduceFiltersToSolr(filters, 'pers_entities_dpfs');
  //   case 'location':
  //     return reduceFiltersToSolr(filters, 'loc_entities_dpfs');
  //   case 'topicmodel':
  //     return reduceFiltersToSolr(filters, 'tp_model_s');
  //   case 'topic-string':
  //     return reduceStringFiltersToSolr(filters, 'topic_suggest', []);
  //   case 'entity-string':
  //     return reduceStringFiltersToSolr(filters, 'entitySuggest', []);
  //   case 'entity-type':
  //     return reduceFiltersToSolr(filters, 't_s');
  //   case 'regex':
  //     return reduceRegexFiltersToSolr(filters);
  //   case 'textReuseClusterSize':
  //     return reduceNumericRangeFilters(filters, 'cluster_size_l');
  //   // TODO: the two fields below are for TR passages,
  //   // the names for clusters are different. This function should take
  //   // index name as a parameter.
  //   case 'textReuseClusterLexicalOverlap':
  //     return reduceNumericRangeFilters(filters, 'cluster_lex_overlap_d');
  //   case 'textReuseClusterDayDelta':
  //     return reduceNumericRangeFilters(filters, 'cluster_day_delta_i');
  //   default:
  //     throw new Error(`Unknown filter type in namespace "${solrNamespace}": ${type}`);
  // }
};

module.exports = {
  filtersToSolr,
  reduceFiltersToSolr,
  reduceRegexFiltersToSolr,
  escapeValue,
};
