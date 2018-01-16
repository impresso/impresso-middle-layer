// name: find
// query is a APOC LUCENE param like 'garde nationale || roma*'
call apoc.index.search('suggestions', {_q})
  YIELD node, weight 
  RETURN node, weight 
  LIMIT {limit}