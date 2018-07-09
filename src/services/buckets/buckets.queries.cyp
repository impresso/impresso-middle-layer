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
RETURN buc, _total
// WITH buc, _total
// OPTIONAL MATCH (buc)-[:contains]->(item)
// RETURN buc, collect(item)[..10] as _related_items,  _total
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
MATCH (u:user {uid:{_exec_user_uid}})-[r:is_creator_of]->(buc:bucket {uid:{uid}})
WITH buc
OPTIONAL MATCH (buc)-[:contains]->(n)
WITH buc, collect(n) as _related_items
RETURN buc, _related_items

// name: create
// create an empty bucket and link to the current user.
//
MATCH (u:user {uid:{_exec_user_uid}})
{{^bucket_uid}}
WITH u
CALL apoc.create.uuids(1)
YIELD uuid
WITH u, uuid
CREATE (buc:bucket {uid: uuid})
{{/bucket_uid}}
{{#bucket_uid}}
WITH u
CREATE (buc:bucket {uid: {bucket_uid}})
{{/bucket_uid}}
SET
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


// name: patch
// modify an already existing bucket if created by current auth user uid
MATCH (u:user {uid:{user__uid}})-[r:is_creator_of]->(buc:bucket {uid:{uid}})
WITH buc
SET
  {{#name}}
  buc.name = {name},
  {{/name}}
  {{#description}}
  buc.description = {description},
  {{/description}}
  buc.last_modified_time = {_exec_time},
  buc.last_modified_date = {_exec_date}
RETURN buc


// name: remove
// permanently remove a bucket
MATCH (u:user {uid:{_exec_user_uid}})-[r:is_creator_of]->(buc:bucket {uid:{uid}})
WITH u, buc
DETACH DELETE buc
WITH u
OPTIONAL MATCH (u)-[r:is_creator_of]->(_buc:bucket)
WITH u, count(r) as _count_buckets
SET
  u.count_buckets = _count_buckets,
  u.last_activity_time = {_exec_time},
  u.last_activity_date = {_exec_date}

//
// name: APOC_set_lucene_index
//
CALL apoc.index.addAllNodes('bucket_suggestions',{
  bucket: ["name", "description"]
})
