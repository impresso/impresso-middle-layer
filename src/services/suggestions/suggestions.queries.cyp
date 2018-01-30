// name: find
// query is a APOC LUCENE param like 'garde nationale || roma*'
call apoc.index.search('suggestions', {_q})
  YIELD node, weight 
  RETURN node, weight
  ORDER BY weight, node.df DESC
  LIMIT {limit}