// name: index
//
CREATE CONSTRAINT ON (buc:bucket) ASSERT buc.uid IS UNIQUE

// name: find
//
MATCH (pro:Project {uid: {Project}})<-[:subscribed_to]-(u:user {uid:{user__uid}})
WITH u, COALESCE(u.count_buckets, 0) as _total
MATCH (u)-[r:is_creator_of]->(buc:bucket {Project:{Project}})
WITH buc, _total
SKIP {skip}
LIMIT {limit}
WITH buc, _total
MATCH (buc)-[:contains]->(item)
RETURN buc, collect(item)[..10] as _related_items,  _total


// name: get
//
MATCH (buc:bucket {uid:{uid}})
WITH (u:user {uid:{user__uid}})-[r:is_creator_of]->(buc)-[:contains]->(n)
WITH buc, collect(n) as _links
RETURN buc, _links


// name: article_create
// create bucket and add relationships with articles
MATCH (art:article) WHERE art.uid IN {uids}
WITH art
MATCH (u:user {uid:{user__uid}})
WITH u, art
CREATE (buc:bucket {uid:{uid}, Project:{Project}, name:{name}})
SET
  {{#description}}
  buc.description = {description},
  {{/description}}
  buc.creation_time = {_exec_time},
  buc.creation_date = {_exec_date}
WITH u, art, buc
MERGE (u)-[r:is_creator_of]->(buc)
MERGE (buc)-[:contains]->(art)
WITH u, buc
MATCH (u)-[r:is_creator_of]->()
WITH u, buc, count(r) as _created
SET u.count_buckets = _created
WITH buc
MATCH (buc)-[r:contains]->(art:article)
WITH buc, count(r) as _contained
SET buc.count_articles = _contained
RETURN buc


// name: page_create
// create bucket and add relationships with pages
MATCH (pag:page)
WHERE pag.uid IN {uids} AND Project = {Project}
WITH pag
MATCH (u:user {uid:{user__uid}})
WITH u, pag
CREATE (buc:bucket {uid:{uid}, Project:{Project}, name:{name}})
SET
  {{#description}}
  buc.description = {description},
  {{/description}}
  buc.creation_time = {_exec_time},
  buc.creation_date = {_exec_date}
WITH u, pag, buc
MERGE (u)-[r:is_creator_of]->(buc)
MERGE (buc)-[:contains]->(pag)
WITH u, buc
MATCH (u)-[r:is_creator_of]->()
WITH u, buc, count(r) as _created
SET u.count_buckets = _created
WITH buc
MATCH (buc)-[r:contains]->(pag:page)
WITH buc, count(r) as _contained
SET buc.count_pages = _contained
RETURN buc



CALL apoc.index.addAllNodes('bucket_suggestions',{
  bucket: ["name"]
})
