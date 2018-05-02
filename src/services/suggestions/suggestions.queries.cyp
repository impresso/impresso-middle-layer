// name: find
// query is a APOC LUCENE param like 'garde nationale || roma*'
call apoc.index.search('suggestions', {q})
  YIELD node, weight
  RETURN node, weight as _weight
  ORDER BY _weight, node.df DESC
  LIMIT {limit}
