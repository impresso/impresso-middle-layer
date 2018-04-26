// name: setup
// constraints
CREATE CONSTRAINT ON (q:query) ASSERT q.uid IS UNIQUE


// name: get
// get current query and the corollarium of parent queries
MATCH (u:user {uid:{user__uid}})-[:searched_for]->(q:query {uid:{uid}, {Project:{Project}})
OPTIONAL MATCH P=(q)-[:develops*]->(pq:query {Project:{Project})
RETURN q, P


// name: find
//
MATCH (u:user {uid:{user__uid}})-[:searched_for]->(q:query)
WHERE q.Project = {Project}
WITH q, u
SKIP {skip}
LIMIT {limit}
WITH q, u, COALESCE(u.count_queries, 0) as total
RETURN q, total


// name: create
//
{{#parent__uid}}
MATCH (pq:query {uid:{parent__uid}, {Project:{Project}})<-[:searched_for]-(u:user {uid:{user__uid}})-[:subscribed_to]->(pro:Project {uid: {Project}})
WITH u, pq
{{/parent__uid}}
{{^parent__uid}}
MATCH (u:user {uid:{user__uid}})-[:subscribed_to]->(pro:Project {uid: {Project}})
WITH u
{{/parent__uid}}

CREATE (q:query {uid:{uid}, {Project:{Project}})
SET
  q.name = {name},

  {{#description}}
  q.description = {description},
  {{/description}}

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
RETURN q, pq, u
{{/parent__uid}}
{{^parent__uid}}
WITH u, q
MERGE (u)-[:searched_for]->(q)
ON CREATE SET
  u.count_queries = COALESCE(u.count_queries, 0) + 1
RETURN q, u
{{/parent__uid}}
