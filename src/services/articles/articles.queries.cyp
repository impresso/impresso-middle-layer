// name: find
// we use the property count_article STORED on current Project. @todo: check if user has access to the project.
//
// {{#order_by}}
// ORDER BY {order_by}
// {{/order_by}}
//
MATCH (pro:Project {uid:{Project}})
WITH COALESCE(pro.count_article, 0) as _total
WITH _total

{{#filters}}
  {{#_isIssue}}
  MATCH (art:article)-[:appears_at]->(pag:page)-[:belongs_to]->(iss:issue)
  WHERE iss.uid IN ['{{uids}}']
  WITH art, _total
  {{/_isIssue}}
  {{#_isNewspaper}}
  MATCH (art:article)
  WHERE art.newspaper_uid IN ['{{uids}}']
  WITH art, _total
  // MATCH (art:article)-[*3]->(news:newspaper {uid:'GDL'}) RETURN art LIMIT 10
  {{/_isNewspaper}}
{{/filters}}
{{^filters}}

  MATCH (art:article)
  WHERE
  {{#uids}}
    art.uid IN {uids}
  {{/uids}}
  art.Project = {Project:{Project}})
{{/filters}}

WITH art, _total

SKIP {skip}
LIMIT {limit}

WITH art, _total
OPTIONAL MATCH (art)-[:appears_at]->(pag:page)
WITH art, _total, collect(pag) as _related_pages
OPTIONAL MATCH (art)-[:appears_at]->(pag:page)-[:belongs_to]->(iss:issue)
WITH art, _total, _related_pages, head(collect(iss)) as _related_issue
OPTIONAL MATCH (tag:tag)-[:describes]->(art)
WITH art, _total, _related_pages, _related_issue, collect(tag) as _related_tags
{{#user__uid}}
// add personal collections / buckets
{{/user__uid}}
RETURN art, _related_pages, _related_issue, _related_tags, _total


// name: find_filtered
// filter based on issue uid for the moment

// name: get
//
MATCH (art:article {Project:{Project}, uid:{uid}})
OPTIONAL MATCH (art)-[:appears_at]->(pag:page)
WITH art, collect(pag) as pages
OPTIONAL MATCH (art)-[:appears_at]->(pag:page)-[:belongs_to]->(iss:issue)
WITH art, pages, iss
LIMIT 1
RETURN art, pages as _related_pages, iss as _related_issue

// name: merge
//
MERGE (art:article {Project:{Project}, uid:{uid}})
SET
  art.date = {date},
  {{#title}}
  art.title = {title},
  {{/title}}
  {{#excerpt}}
  art.excerpt = {excerpt},
  {{/excerpt}}
  art.newspaper_uid = {newspaper__uid}
WITH art
MATCH (pag:page {Project:{Project}, uid:{page__uid}})
MERGE (art)-[r:appears_at]->(pag)
SET r.regions = {regions}
RETURN art

// name:setup
//
CREATE INDEX ON :article(newspaper_uid)
CREATE INDEX ON :article(date)
CREATE INDEX ON :article(time)

// name: APOC_set_article__newspaper_uid
// Given the art.uid, SET the art.newspaper_uid
CALL apoc.periodic.iterate(
  "MATCH (art:article {Project:{Project}}) RETURN art",
  "WITH art SET art.newspaper_uid = head(split(art.uid, '-'))",
  {batchSize:100, iterateList:true, parallel:true, params:{Project:{Project}}})


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


// name: APOC_set_issue__count_articles
// n. of articles in a issue.
CALL apoc.periodic.iterate(
  "MATCH (art:article)-[:appears_at]->(pag:page)-[:belongs_to]->(iss:issue {Project:{Project}}) RETURN iss, count(DISTINCT art) as count_articles",
  "SET iss.count_articles = count_articles",
  {batchSize:500, iterateList:true, parallel:true, params:{Project:{Project}}})

// name: APOC_set_newspaper__count_articles
// n of articles per newspaper. Please call AFTER APOC_set_issue__count_articles :D
CALL apoc.periodic.iterate(
  "MATCH (iss:issue)-[:belongs_to]->(news:newspaper {Project:{Project}}) RETURN news, sum(COALESCE(iss.count_articles, 0)) as count_articles",
  "SET news.count_articles = count_articles",
  {batchSize:10, iterateList:true, parallel:true, params:{Project:{Project}}})

// name: APOC_set_article__date
// Given the art.uid, SET the art.date
CALL apoc.periodic.iterate(
  "MATCH (art:article {Project:{Project}}) RETURN art",
  "SET art.date = apoc.text.replace(art.uid, '.*-([0-9]{4}-[0-9]{2}-[0-9]{2})-.*$', '$1')",
  {batchSize:50, iterateList:true, parallel:true, params:{Project:{Project}}})

// name: APOC_set_article__time
// given the art.date, SET art.time
CALL apoc.periodic.iterate(
  "MATCH (art:article {Project:{Project}}) RETURN art",
  "SET art.time = apoc.date.parse(art.date,'s','yyyy-MM-dd')",
  {batchSize:100, iterateList:true, parallel:true, params:{Project:{Project}}})
