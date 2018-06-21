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
  {{#_isissue}}
  MATCH (art:article)-[:appears_at]->(pag:page)-[:belongs_to]->(iss:issue)
  WHERE iss.uid IN ['{{uids}}']
  WITH art, _total
  {{/_isissue}}
  {{#_isnewspaper}}
  MATCH (art:article)
  WHERE art.newspaper_uid IN ['{{uids}}']
  WITH art, _total
  // MATCH (art:article)-[*3]->(news:newspaper {uid:'GDL'}) RETURN art LIMIT 10
  {{/_isnewspaper}}
  {{#_isstring}}
  MATCH (art:article)
  WHERE art.Project = {Project}
  WITH art, _total
  // MATCH (art:article)-[*3]->(news:newspaper {uid:'GDL'}) RETURN art LIMIT 10
  {{/_isstring}}
  {{#_isentity}}
  MATCH (art:article)
  WHERE art.Project = {Project}
  WITH art, _total
  {{/_isentity}}
{{/filters}}
{{^filters}}
  MATCH (art:article)
  {{#uids}}
  WHERE art.uid IN {uids}
  {{/uids}}
  {{^uids}}
  WHERE art.Project = {Project}
  {{/uids}}
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

// name:findAll
// find all matching uids
MATCH (art:article)
WHERE art.uid IN {uids} AND art.Project = {Project}
WITH art
OPTIONAL MATCH (art)-[:appears_at]->(pag:page)
WITH art, collect(pag) as _related_pages
OPTIONAL MATCH (art)-[:appears_at]->(pag:page)-[:belongs_to]->(iss:issue)
WITH art, _related_pages, head(collect(iss)) as _related_issue
OPTIONAL MATCH (tag:tag)-[:describes]->(art)
WITH art, _related_pages, _related_issue, collect(tag) as _related_tags
{{^_exec_user_uid}}
RETURN art, _related_pages, _related_issue, _related_tags, [] as _related_buckets
{{/_exec_user_uid}}
{{#_exec_user_uid}}
OPTIONAL MATCH (u:user {uid: {_exec_user_uid}})-[:is_creator_of]->(buc:bucket)-[:contains]->(art)
RETURN art, _related_pages, _related_issue, _related_tags, collect(buc) as _related_buckets
{{/_exec_user_uid}}



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
  art.year = {year},
  {{#title}}
  art.title = {title},
  {{/title}}
  {{#excerpt}}
  art.excerpt = {excerpt},
  {{/excerpt}}
  art.newspaper_uid = {newspaper__uid}
WITH art
MATCH (pag:page)
WHERE pag.uid IN {page__uids} AND pag.Project = {Project}
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


// name: APOC_create_issue_from_article
// Special apoc query to deal with orphelins
MATCH (pag:page)
WHERE NOT (pag)-[:belongs_to]->()
  AND pag.Project = 'impresso'
WITH pag,
apoc.text.replace(pag.uid, '([A-Z]+)-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z].*$', '$1') as newspaper_uid,
apoc.text.replace(pag.uid, '([A-Z]+)-([0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z]).*$', '$1-$2') as issue_uid,
apoc.text.replace(pag.uid, '[A-Z]+-([0-9]{4}-[0-9]{2}-[0-9]{2})-[a-z].*$', '$1') as issue_date,
apoc.text.replace(pag.uid, '[A-Z]+-([0-9]{4})-[0-9]{2}-[0-9]{2}-[a-z].*$', '$1') as issue_year
WITH pag, issue_uid, issue_date, toInteger(issue_year) as year, newspaper_uid
LIMIT 5000
MATCH (news:newspaper {uid: newspaper_uid})
WITH pag, issue_uid, issue_date, year, news
MERGE (iss:issue {uid:issue_uid, Project:'impresso'})
ON CREATE SET
  iss.count_articles = -1,
  iss.count_pages = -1,
  iss.date = issue_date,
  iss.year = year
WITH iss, pag, news
MERGE (pag)-[:belongs_to]->(iss)
MERGE (iss)-[:belongs_to]->(news)
RETURN pag.uid, iss.uid, news.uid
