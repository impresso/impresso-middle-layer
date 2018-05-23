// name: merge
// create action item and add relationships with articles
MATCH (u:user {uid:{user__uid}}), (tag:tag {uid:{tag__uid}}), (art:article {uid:{article__uid}})
WITH u, art, tag
MERGE (tag)-[r:describes]->(art)
ON CREATE SET
  r.creation_time = {_exec_time},
  r.creation_date = {_exec_date},
  r.creator = u.uid
SET
  r.last_modified_time = {_exec_time},
  r.last_modified_date = {_exec_date}
WITH u, art, tag
MERGE (act:Action {uid:{_uid}, Project:{Project}})
ON CREATE SET
  act.creation_time = {_exec_time},
  act.creation_date = {_exec_date},
  act.type = {type}
SET
  act.last_modified_time = {_exec_time},
  act.last_modified_date = {_exec_date}
MERGE (u)-[:is_creator_of]->(act)
MERGE (act)-[:links]->(art)
MERGE (act)-[:links]->(tag)
RETURN act as action, tag, art as article

// name: find
//
RETURN []
