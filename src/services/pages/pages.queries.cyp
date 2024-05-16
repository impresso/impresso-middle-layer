// name: setup
// constraints
CREATE CONSTRAINT ON (p:page) ASSERT p.uid IS UNIQUE
CREATE INDEX ON :issue(year)

// name: find
// all pages related to one issue or a generic list of pages
{{#issue__uid}}
MATCH (p:page)-[:belongs_to]->(iss:issue {uid:{issue__uid}})
WHERE p.Project = {Project}
WITH p, COALESCE(iss.count_pages, -1) as _total
{{/issue__uid}}

{{^issue__uid}}
MATCH (pro:Project {uid: {Project}})
WITH COALESCE(pro.count_pages, -1) as _total
MATCH (p:page)
WHERE p.Project = {Project}
WITH p, _total
{{/issue__uid}}

SKIP {offset}
LIMIT {limit}
RETURN p, _total


// name:findAll
// find all matching uids
MATCH (pag:page)
WHERE pag.uid IN {uids} AND pag.Project = {Project}
WITH pag
MATCH (pag)-[r:belongs_to]->(iss:issue)
WITH pag, head(collect(iss)) as _related_issue

{{#_exec_user_uid}}
  OPTIONAL MATCH (u:user {uid:{_exec_user_uid}})-[:is_creator_of]->(buc:bucket)-[:contains]->(pag)
  WITH pag, _related_issue, collect(buc) as _related_buckets
{{/_exec_user_uid}}

{{^_exec_user_uid}}
  WITH pag, _related_issue, [] as _related_buckets
{{/_exec_user_uid}}

RETURN pag, _related_issue, _related_buckets

// name: get
//
MATCH (pag:page {uid:{uid}})
OPTIONAL MATCH (pag)<-[r:appears_at]-(art:article)
WITH pag, CASE WHEN r IS NOT NULL THEN collect({
  regions: properties(r).regions,
  article_uid: art.uid
}) ELSE [] END as _related_regions
OPTIONAL MATCH (pag)<-[:appears_at]-(art:article)
WITH pag, _related_regions, collect(art) as _related_articles
OPTIONAL MATCH (pag)<-[:appears_at]-(art:article)
WITH pag, _related_regions, _related_articles, art
// collect top 20 entities
OPTIONAL MATCH (art)<-[r:appears_in]-(ent:entity)
WITH pag, _related_regions, _related_articles, r, art, ent
ORDER BY r.ntf DESC
SKIP 0
LIMIT 20
WITH pag, _related_regions, _related_articles,
CASE WHEN r IS NOT NULL THEN collect({
  properties: properties(r),
  type: type(r),
  article_uid: art.uid,
  entity_uid: ent.uid
}) ELSE [] END as _related_articles_entities, collect(ent) as _related_entities
WITH pag, _related_regions, _related_articles, _related_articles_entities, _related_entities
// collect tags
OPTIONAL MATCH (t:tag)-[r:describes]->(art:article)-[:appears_at]->(pag)
WITH pag, _related_regions, _related_articles, _related_articles_entities, _related_entities,
CASE WHEN r IS NOT NULL THEN collect({
  properties: properties(r),
  type: type(r),
  article_uid: art.uid,
  tag_uid: t.uid
}) ELSE [] END as _related_articles_tags, collect(DISTINCT t) as _related_tags

// collect buckets if connected to the page if theres a specific creator
{{#_exec_user_uid}}
WITH pag, _related_regions, _related_articles, _related_articles_entities, _related_entities, _related_articles_tags, _related_tags
OPTIONAL MATCH (u:user {uid:{user__uid}})-[:is_creator_of]->(buc:bucket)-[:contains]->(pag)

WITH pag,
    _related_regions, _related_articles,
    _related_articles_entities, _related_entities,
    _related_articles_tags, _related_tags,
    collect(buc) as _related_buckets

RETURN pag,
    _related_regions, _related_articles,
    _related_articles_entities, _related_entities,
    _related_articles_tags, _related_tags,
    _related_buckets

{{/_exec_user_uid}}
{{^_exec_user_uid}}
RETURN pag, _related_regions, _related_articles, _related_articles_entities, _related_entities, _related_articles_tags, _related_tags
{{/_exec_user_uid}}
LIMIT 1


// name: merge
//
MERGE (pag:page {Project:{Project}, uid:{uid}})
  ON CREATE SET
    pag.num  = toInteger({page_number})
WITH pag
MATCH (iss:issue {Project:{Project}, uid:{issue_uid}})
MERGE (pag)-[r:belongs_to]->(iss)
RETURN pag


// name: count
//
MATCH (pag:page {Project:{Project}})
WITH count(pag) as count_pages
MATCH (pro:Project {uid: {Project}})
SET pro.count_pages = count_pages
RETURN pro.count_pages

// name: APOC_set_issue__count_pages
//
CALL apoc.periodic.iterate(
  "MATCH (pag:page)-[:belongs_to]->(iss:issue {Project:{Project}}) RETURN iss, count(pag) as count_pages",
  "SET iss.count_pages = count_pages",
  {batchSize:500, iterateList:true, parallel:true, params:{Project:{Project}}})

// name: APOC_set_newspaper__count_pages
// AFTER APOC_set_issue__count_pages :D
CALL apoc.periodic.iterate(
  "MATCH (iss:issue)-[:belongs_to]->(news:newspaper {Project:{Project}}) RETURN news, sum(COALESCE(iss.count_pages, 0)) as count_pages",
  "SET news.count_pages = count_pages",
  {batchSize:100, iterateList:true, parallel:true, params:{Project:{Project}}})

// name: APOC_set_page__uid_as_canonical
// used only once.
CALL apoc.periodic.iterate(
  "MATCH (pag:page {Project:{Project}}) WHERE pag.uid  =~ '.*-[0-9]{4}$' RETURN pag",
  "SET pag.uid = apoc.text.replace(pag.uid, '-([0-9]{4})$', '-p$1')",
  {batchSize:100, iterateList:true, parallel:true, params:{Project:{Project}}})
