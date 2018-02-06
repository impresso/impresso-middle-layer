// name: setup
// constraints
CREATE CONSTRAINT ON (u:user) ASSERT u.uid IS UNIQUE

// name: create
// create an user.
MATCH (pro:Project {uid: {Project}})
WITH pro
CREATE (u:user {uid:{uid}})
SET
  {{#email}}
  u.email     = {email},
  {{/email}}
  
  {{#displayname}}
  u.displayname = {displayname},
  {{/displayname}}
  
  
  {{#picture}}
  u.picture = {picture},
  {{/picture}}

  u.provider = {provider},
  u.username = {username},
  u.password  = {password},
  u.creation_time = {_exec_time},
  u.creation_date = {_exec_date}
  
  // u.salt         = {salt} // crypto.randomBytes(16).toString('hex'),
WITH u, pro
MERGE (u)-[:subscribed_to]->(pro)
RETURN u


// name: find
// find an user given the email, optionally is connected to the project

MATCH (u:user {uid:{uid}})
OPTIONAL MATCH (u)-[:subscribed_to]->(pro:Project {uid: {Project}})
WITH u, pro, 1 as total
RETURN u, total
SKIP {skip}
LIMIT {limit}