// @ts-check
const YAML = require('yaml');
const { readFileSync } = require('fs');

const filtersConfig = YAML.parse(readFileSync(`${__dirname}/solrFilters.yml`).toString());

const escapeValue = value => value.replace(/[()\\+&|!{}[\]?:;,]/g, d => `\\${d}`);

const getValueWithFields = (value, fields) => {
  if (Array.isArray(fields)) {
    return fields.map(field => getValueWithFields(value, field)).join(' OR ');
  }
  return `${fields}:${escapeValue(value)}`;
};
const RangeValueRegex = /^\s*\d+\s+TO\s+\d+\s*$/;

const reduceNumericRangeFilters = (filters, field) => {
  const items = filters.reduce((sq, filter) => {
    let q; // q is in the form array ['1 TO 10', '20 TO 30'] (OR condition)
    // or simple string '1 TO X';
    if (Array.isArray(filter.q)) {
      if (filter.q.length !== 2 || !filter.q.every(v => Number.isFinite(parseInt(v, 10)))) {
        throw new Error(`"numericRange" filter rule: unknown values encountered in "q": ${filter.q}`);
      }
      q = `${field}:[${filter.q[0]} TO ${filter.q[1]}]`;
    } else {
      if (!filter.q.match(RangeValueRegex)) {
        throw new Error(`"numericRange" filter rule: unknown value encountered in "q": ${filter.q}`);
      }
      q = `${field}:[${filter.q}]`;
    }
    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT (${q})` : `*:* AND NOT (${q})`;
    }
    sq.push(q);
    return sq;
  }, []);

  return items.join(' AND ');
};

const SolrSupportedLanguages = ['en', 'fr', 'de'];

const fullyEscapeValue = value => escapeValue(value).replace(/"/g, d => `\\${d}`);

/**
 * Convert filter to a Solr request.
 * @param {string} value filter value
 * @param {*} solrFields Solr fields to apply the value to.
 * @param {*} precision filter precision.
 */
const getStringQueryWithFields = (value, solrFields, precision) => {
  let q = value.trim();
  const hasMultipleWords = q.split(/\s/).length > 1;
  const isExact = q.match(/^"(.*)"(~[12345])?$/);
  const isFuzzy = q.match(/^(.*)~([12345])$/);
  if (isExact && isFuzzy) {
    q = `"${fullyEscapeValue(isExact[1])}"${isExact[2]}`;
  } else if (isExact) {
    q = `"${fullyEscapeValue(isExact[1])}"`;
  } else if (isFuzzy) {
    q = `"${fullyEscapeValue(isFuzzy[1])}"`;
  } else {
    // use filter properties if set
    q = fullyEscapeValue(q);
    if (precision === 'soft') {
      q = `(${q.split(/\s+/g).join(' OR ')})`;
    } else if (precision === 'fuzzy') {
      // "richard chase"~1
      q = `"${q.split(/\s+/g).join(' ')}"~1`;
    } else if (precision === 'exact') {
      q = `"${q}"`;
    } else if (hasMultipleWords) {
      // text:"Richard Chase"
      q = q.replace(/"/g, ' ');
      q = `"${q.split(/\s+/g).join(' ')}"`;
      q = `(${q.split(/\s+/g).join(' ')})`;
    }
  }

  const items = solrFields.map(f => `${f}:${q}`);
  const statement = items.join(' OR ');
  return items.length > 1 ? `(${statement})` : statement;
};

/**
 * String type filter handler
 * @param {object[]} filters
 * @param {string | string[] | object} field
 * @return {string} solr query
 */
const reduceStringFiltersToSolr = (filters, field) => {
  const items = filters.map(({
    q,
    op = 'OR',
    langs: languages = SolrSupportedLanguages,
    precision,
    context,
  }, index) => {
    let fields = [];

    if (typeof field === 'string') fields = [field];
    else if (Array.isArray(field)) fields = field;
    else if (field.prefix != null) fields = languages.map(lang => `${field.prefix}${lang}`);
    else throw new Error(`Unknown type of Solr field: ${JSON.stringify(field)}`);

    const queryList = Array.isArray(q) ? q : [q];

    let transformedQuery = queryList
      .map(value => getStringQueryWithFields(value, fields, precision))
      // @ts-ignore
      .flat()
      .join(` ${op} `);

    if (context === 'exclude') {
      transformedQuery = index > 0 ? `NOT (${transformedQuery})` : `*:* AND NOT (${transformedQuery})`;
    }

    return queryList.length > 1 ? `(${transformedQuery})` : transformedQuery;
  });

  // @ts-ignore
  return items.flat().join(' AND ');
};

const DateRangeValueRegex = /^\s*[TZ:\d-]+\s+TO\s+[TZ:\d-]+\s*$/;

const reduceDaterangeFiltersToSolr = (filters, field, rule) => {
  const items = filters.reduce((sq, filter) => {
    let q;
    if (Array.isArray(filter.q)) {
      q = `${filter.q.map(d => `${field}:[${d}]`).join(' OR ')}`;
      if (filter.q.length > 1) {
        q = `(${q})`;
      }
    } else {
      if (!filter.q.match(DateRangeValueRegex)) {
        throw new Error(`"${rule}" filter rule: unknown value encountered in "q": ${filter.q}`);
      }
      q = `meta_date_dt:[${filter.q}]`;
    }
    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT (${q})` : `*:* AND NOT (${q})`;
    }
    sq.push(q);
    return sq;
  }, []);
  return items.join(' AND ');
};

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

const reduceRegexFiltersToSolr = (filters, field) => {
  let fields = [];
  if (typeof field === 'string') fields = [field];
  else if (Array.isArray(field)) fields = field;
  else if (field.prefix != null) fields = SolrSupportedLanguages.map(lang => `${field.prefix}${lang}`);
  else throw new Error(`Unknown type of Solr field: ${JSON.stringify(field)}`);

  return filters.reduce((reduced, { q, op = 'OR' }) => {
  // cut regexp at any . not preceded by an escape sign.
    let queryString;
    if (Array.isArray(q)) {
      if (q.length !== 1) {
        throw new Error(`"regex" filter rule supports only single element arrays in "q": ${JSON.stringify(q)}`);
      }
      queryString = q[0].trim();
    } else {
      queryString = q.trim();
    }

    const query = queryString
    // get rid of first / and last /
      .replace(/^\/|\/$/g, '')
    // split on point or spaces
      .split(/\\?\.[*+]/)
    // filterout empty stuff
      .filter(d => d.length)
    // rebuild;
      .map(d => fields.map(f => `${f}:/${d}/`).join(` ${op} `));
    return reduced.concat(query.map(v => (fields.length > 1 ? `(${v})` : v)));
  }, []).join(' AND ');
};

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
  dateRange: reduceDaterangeFiltersToSolr,
  value: reduceFiltersToSolr,
  regex: reduceRegexFiltersToSolr,
});

/**
 * Convert a set of filters of the same type to a SOLR query string.
 * Types are defined in `solrFilters.yml` for the corresponding namespace
 *
 * @param {import('../../models').Filter[]} filters list of filters of the same type.
 * @param {string} solrNamespace namespace (index) this filter type belongs to.
 *
 * @returns {string} a SOLR query string that can be wrapped into a `filter()` statement.
 */
const filtersToSolr = (filters, solrNamespace) => {
  if (filters.length < 1) throw new Error('At least one filter must be provided');
  const types = [...new Set(filters.map(({ type }) => type))];
  if (types.length > 1) throw new Error(`Filters must be of the same type. Found types: "${types}"`);
  const type = types[0];

  const filtersRules = filtersConfig.indexes[solrNamespace]
    ? filtersConfig.indexes[solrNamespace].filters
    : {};
  const filterRules = filtersRules[type];
  if (filterRules == null) throw new Error(`Unknown filter type "${type}" in namespace "${solrNamespace}"`);

  const handler = FiltersHandlers[filterRules.rule];
  if (handler == null) throw new Error(`Could not find handler for rule ${filterRules.rule}`);

  return handler(filters, filterRules.field, filterRules.rule);
};

module.exports = {
  filtersToSolr,
  escapeValue,
};
