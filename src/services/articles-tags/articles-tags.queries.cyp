// name: merge
// create tag if it doesn't exist.
MATCH (u:user {uid:{user_uid}})-[:subscribed_to]->(pro:Project {uid: {Project}})
WITH u
MATCH (art:article {uid:{article_uid}})
WHERE art.Project = {Project}
WITH u, art
LIMIT 1
MERGE (tag:bucket:tag {uid:{tag_uid}})
  ON CREATE SET
    tag.creation_time = {_exec_time},
    tag.creation_date = {_exec_date},
    tag.name = {tag_name}
SET
  tag.last_modified_time = {_exec_time},
  tag.last_modified_date = {_exec_date}
WITH u, art, tag
MERGE (u)-[r1:is_creator_of]->(tag)
WITH art, tag
MERGE (tag)-[r2:describes]->(art)
  ON CREATE SET
    r2.creation_time = {_exec_time},
    r2.creation_date = {_exec_date}
WITH tag
MATCH (tag)-[r:describes]->()
WITH tag, count(r) as count_articles
SET tag.count_articles = count_articles
RETURN tag

// name: remove
//
MATCH (u:user {uid: {user_uid}})-[:subscribed_to]->(pro:Project {uid: {Project}})
WITH u
MATCH (u)-[:is_creator_of]->(tag:bucket:tag {uid: {tag_uid}})-[r:describes]->(art:article {uid: {article_uid}})
DELETE r
WITH tag
MATCH (tag)-[r:describes]->()
WITH tag, count(r) as count_articles
SET tag.count_articles = count_articles
RETURN tag


// name: __merge
// create action item and add relationships with articles
MATCH (u:user {uid:{user__uid}}), (tag:bucket:tag {uid:{tag__uid}}), (art:article {uid:{article__uid}})
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
