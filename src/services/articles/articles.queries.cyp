// name: find
// we use the property count_article STORED on current Project. @todo: check if user has access to the project.
MATCH (pro:Project {uid:{Project}})
WITH pro.count_article as total
MATCH (art:article {Project:{Project}})
WITH art, total
{{#order_by}}
ORDER BY {order_by}
{{/order_by}}

SKIP {skip}
LIMIT {limit}

WITH art, total
MATCH (art)-[:appears_at]->(pag:page)
WITH art, total, collect(pag) as pages
RETURN {
  uid: art.uid,
  title: art.title,
  dl: art.dl,

  pages: pages

} as art, total


// name: get
//
MATCH (art:article {Project:{Project}, uid:{uid}})
RETURN art


// name: APOC_set_article__dl
// calculate and store number of different entities per article: 
// TASK=run_query QUERIES=./src/services/articles/articles.queries.cyp NAME=APOC_set_article__dl npm run cli
CALL apoc.periodic.iterate(
  "MATCH (art:article {Project:{Project}}) WHERE (art)<-[:appears_in]-() RETURN art",
  "MATCH (art)<-[r:appears_in]-() WITH art, count(r) as dl SET art._dl = dl", 
  {batchSize:100, iterateList:true, parallel:true, params:{Project:{Project}}})


// name: APOC_set_article__stfs
// calculate and store number of different entities per article: 
// TASK=run_query QUERIES=./src/services/articles/articles.queries.cyp NAME=APOC_set_article__stfs npm run cli
CALL apoc.periodic.iterate(
  "MATCH (art:article {Project:{Project}}) RETURN art",
  "MATCH (art)<-[r:appears_in]-() WITH art, sum(r.tf) as sum_of_tfs SET art._stfs = sum_of_tfs",
  {batchSize:100, iterateList:true, parallel:true, params:{Project:{Project}}})