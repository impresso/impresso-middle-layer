// name: index
//
CREATE CONSTRAINT ON (buc:bucket) ASSERT buc.uid IS UNIQUE
CREATE INDEX ON :bucket(last_modified_time)

// name: find
//
MATCH (pro:Project {uid: {Project}})<-[:subscribed_to]-(u:user {uid:{user__uid}})
WITH u, COALESCE(u.count_buckets, 0) as _total
{{#q}}
CALL apoc.index.search('bucket_suggestions', {q})
  YIELD node AS buc
MATCH (u)-[r:is_creator_of]->(buc)
WITH buc, _total
{{/q}}

{{^q}}
MATCH (u)-[r:is_creator_of]->(buc:bucket)
{{/q}}

WITH buc, _total
{{#order_by}}
ORDER BY {{order_by}}
{{/order_by}}
SKIP {skip}
LIMIT {limit}
WITH buc, _total
OPTIONAL MATCH (buc)-[:contains]->(item)
RETURN buc, collect(item)[..10] as _related_items,  _total
{{#order_by}}
ORDER BY {{order_by}}
{{/order_by}}

// name: findAll
// given a set of uids, return all buckets with all content.
//
MATCH (buc:bucket)
WHERE buc.uid IN {uids} AND buc.Project = {Project}
WITH buc
MATCH (u:user {uid:{user__uid}})-[r:is_creator_of]->(buc)
WITH buc
MATCH (buc)-[:contains]->(n)
RETURN buc, collect(n) as _related_items

// name: get
//
MATCH (u:user {uid:{user__uid}})-[r:is_creator_of]->(buc:bucket {uid:{uid}})
WITH buc
MATCH (buc)-[:contains]->(n)
WITH buc, collect(n) as _related_items
RETURN buc, _related_items


// name: remove
// permanently remove a bucket
MATCH (u:user {uid:{user__uid}})-[r:is_creator_of]->(buc:bucket {uid:{uid}})
WITH buc
DETACH DELETE buc


// name: create
// create an empty bucket and link to the current user.
//
MATCH (u:user {uid:{user__uid}})
WITH u
CALL apoc.create.uuids(1)
YIELD uuid
WITH u, uuid
CREATE (buc:bucket)
SET
  buc.uid = uuid,
  buc.Project = {Project},
  buc.name = {name},
  buc.slug = {slug},
  {{#description}}
  buc.description = {description},
  {{/description}}
  buc.creation_time = {_exec_time},
  buc.creation_date = {_exec_date},
  buc.last_modified_time = {_exec_time},
  buc.last_modified_date = {_exec_date},
  buc.count_pages = 0,
  buc.count_articles = 0,
  buc.count_issues = 0,
  buc.count_entities = 0
WITH u, buc
MERGE (u)-[r:is_creator_of]->(buc)
WITH u, buc
MATCH (u)-[r:is_creator_of]->(_buc:bucket)
WITH u, buc, count(r) as _created
SET u.count_buckets = _created
RETURN buc

// name: APOC_set_lucene_index
//
CALL apoc.index.addAllNodes('bucket_suggestions',{
  bucket: ["name", "description"]
})
