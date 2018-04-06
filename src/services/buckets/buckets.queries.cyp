// name: find
//
MATCH (pro:Project {uid: {Project}})<-[:subscribed_to]-(u:user {uid:{user_uid}})-[r:is_owner_of]->(buc:bucket {Project:{Project}})
RETURN buc

// name: get
//
MATCH (u:user {uid:{user_uid}})-[r:is_owner_of]->(buc:bucket {uid:{uid}, Project:{Project}})
RETURN buc


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
