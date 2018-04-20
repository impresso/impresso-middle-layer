// name: index
//
CREATE CONSTRAINT ON (buc:bucket) ASSERT buc.uid IS UNIQUE

// name: find
//
MATCH (pro:Project {uid: {Project}})<-[:subscribed_to]-(u:user {uid:{user_uid}})
WITH u, COALESCE(u.count_buckets, 0) as total
OPTIONAL MATCH (u)-[r:is_creator_of]->(buc:bucket {Project:{Project}})
RETURN buc, total
SKIP {skip}
LIMIT {limit}



// name: get
//
MATCH (buc:bucket {uid:{uid}})
WITH (u:user {uid:{user_uid}})-[r:is_creator_of]->(buc)-[:contains]->(n)
WITH buc, collect(n) as collected
RETURN {
  uid: buc.uid,
  name: buc.name,
  description: buc.description,
  collected: collected
}


// name: article_create
// create bucket and add relationships with articles
MATCH (art:article) WHERE art.uid IN {uids}
WITH art
MATCH (u:user {uid:{user_uid}})
WITH u, art
CREATE (buc:bucket {uid:{uid}, Project:{Project}, name:{name}})
SET
  {{#description}}
  description = {description},
  {{/description}}
  buc.creation_time = {_exec_time},
  buc.creation_date = {_exec_date}

WITH u, art, buc
MERGE (u)-[r:is_creator_of]->(buc)
MERGE (buc)-[:contains]->(art)
RETURN buc
