// name: setup
// constraints
CREATE CONSTRAINT ON (q:query) ASSERT q.uid IS UNIQUE


// name: get
// get current query and the corollarium of parent queries
MATCH (u:user {uid:{user__uid}})-[:searched_for]->(q:query {uid:{uid}, Project:{Project}})
WITH q
LIMIT 1
OPTIONAL MATCH Anc=(q)-[:develops*]->(pq:query)
WHERE size( (pq)-[:develops]->() ) = 0
WITH q, collect(Anc) as _ancestors
OPTIONAL MATCH Des=(q)<-[:develops*]-(cq:query)
WHERE size( (cq)<-[:develops]-() ) = 0
RETURN q, _ancestors, collect(Des) as _descendants


// name: find
//
MATCH (u:user {uid:{user__uid}})-[:searched_for]->(q:query)
WHERE q.Project = {Project}
WITH q, u
SKIP {skip}
LIMIT {limit}
WITH q, u, COALESCE(u.count_queries, 0) as _total
RETURN q, _total


// name: create
// 
{{#parent__uid}}
MATCH (pq:query {uid:{parent__uid}, Project:{Project}})<-[:searched_for]-(u:user {uid:{user__uid}})-[:subscribed_to]->(pro:Project {uid: {Project}})
WITH u, pq
{{/parent__uid}}
{{^parent__uid}}
MATCH (u:user {uid:{user__uid}})-[:subscribed_to]->(pro:Project {uid: {Project}})
WITH u
{{/parent__uid}}

CREATE (q:query {uid:{uid}, Project:{Project}})
SET
  q.name = {name},

  {{#description}}
  q.description = {description},
  {{/description}}
  {{#parent__uid}}
  q.parent__uid = {parent__uid},
  {{/parent__uid}}
  q.data = {data},

  q.creation_time = {_exec_time},
  q.creation_date = {_exec_date}

{{#parent__uid}}
WITH u, q, pq
MERGE (u)-[:searched_for]->(q)
ON CREATE SET
  u.count_queries = COALESCE(u.count_queries, 0) + 1
WITH u, q, pq
MERGE (q)-[:develops]->(pq)
RETURN q, pq as _related_parent, u as _related_user
{{/parent__uid}}
{{^parent__uid}}
WITH u, q
MERGE (u)-[:searched_for]->(q)
ON CREATE SET
  u.count_queries = COALESCE(u.count_queries, 0) + 1
RETURN q, u as _related_user
{{/parent__uid}}


// name: remove
//
MATCH (u:user {uid:{user__uid}})-[:searched_for]->(q:query {uid:{uid}, Project:{Project}})
WITH u, q
MATCH (q)-[r]-()
DELETE q,r
