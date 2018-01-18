// name: find
// query is a APOC LUCENE param like 'garde nationale || roma*'
call apoc.index.search('suggestions', {_q}, {limit})
  YIELD node, weight 
  RETURN node, weight