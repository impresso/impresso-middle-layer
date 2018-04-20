// name: setup
// constraints
CREATE CONSTRAINT ON (u:user) ASSERT u.uid IS UNIQUE

// name: create
// create an user.  salt is created crypto.randomBytes(16).toString('hex'),
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
  u.password = {password},
  {{#salt}}
  u.salt     = {salt},
  {{/salt}}
  u.creation_time = {_exec_time},
  u.creation_date = {_exec_date}


WITH u, pro
MERGE (u)-[:subscribed_to]->(pro)
RETURN u


// name: find
// find an user given the email, optionally is connected to the project
{{#uid}}
MATCH (u:user {uid:{uid}})
OPTIONAL MATCH (u)-[:subscribed_to]->(pro:Project {uid: {Project}})
{{/uid}}

{{^uid}}
MATCH (staff:user {uid:{user_uid}})
WITH staff
MATCH (u:user)-[:subscribed_to]->(pro:Project {uid: {Project}})
{{/uid}}
WITH u, pro, 1 as total
RETURN u, total
SKIP {skip}
LIMIT {limit}


// name: get
// find an user given the email, optionally is connected to the project
MATCH (u:user {uid:{uid}})
RETURN {
  uid: u.uid,
  username: u.username,
  is_staff: u.is_staff
}
