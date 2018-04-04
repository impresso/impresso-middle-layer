// name: find
// we use the property count_article STORED on current Project. @todo: check if user has access to the project.
//
// {{#order_by}}
// ORDER BY {order_by}
// {{/order_by}}
//
MATCH (pro:Project {uid:{Project}})
WITH pro.count_article as total
MATCH (art:article {Project:{Project}})

WITH art, total

SKIP {skip}
LIMIT {limit}

WITH art, total
OPTIONAL MATCH (art)-[:appears_at]->(pag:page)
WITH art, total, collect(pag) as pages
OPTIONAL MATCH (art)-[:appears_at]->(pag:page)-[:belongs_to]->(iss:issue)
WITH art, total, pages, collect(iss) as issues
RETURN {
  uid: art.uid,
  title: art.title,
  dl: art.dl,
  pages: pages,
  issue: head(issues)
} as art, total


// name: get
//
MATCH (art:article {Project:{Project}, uid:{uid}})-[:appears_at]->(pag:page)
WITH art, collect(pag) as pages
MATCH (art)-[:appears_at]->(pag:page)-[:belongs_to]->(iss:issue)
WITH art, pages, iss
LIMIT 1
WITH art, pages, iss
RETURN {
  uid: art.uid,
  title: art.title,
  dl: art.dl,
  pages: pages,
  issue: iss
} as art


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
