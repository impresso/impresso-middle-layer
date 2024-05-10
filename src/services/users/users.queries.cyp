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


WITH u, pro, u.uid + "-FAV" AS fav_bucket_uid
MERGE (u)-[:subscribed_to]->(pro)
// favourites!
WITH u, fav_bucket_uid
CREATE (buc:bucket {uid: fav_bucket_uid})
SET
  buc.Project = {Project},
  buc.is_fixed = true,
  buc.name = 'FAVOURITES',
  buc.slug = 'favourites',
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
RETURN u, buc as _related_favourites


// name: find
// find an user given the email, optionally is connected to the project
{{#uid}}
MATCH (u:user)
WHERE  u.uid = {uid} OR u.username = {uid} OR u.email = {uid}
WITH u LIMIT 1
WITH u
OPTIONAL MATCH (u)-[:subscribed_to]->(pro:Project {uid: {Project}})
{{/uid}}

{{^uid}}
MATCH (staff:user {uid:{user_uid}})
WITH staff
MATCH (u:user)-[:subscribed_to]->(pro:Project {uid: {Project}})
{{/uid}}
WITH u, pro, 1 as _total
RETURN u, _total
SKIP {offset}
LIMIT {limit}

// name: remove
// permanently remove an user. Staff only.
MATCH (u:user)
WHERE u.uid = {uid} OR u.username = {uid}
WITH u LIMIT 1
MATCH (u)-[:subscribed_to]->(pro:Project {uid:{Project}})
WITH u
OPTIONAL MATCH (u)-[r:is_creator_of]->(n)
DETACH DELETE n
DETACH DELETE u


// name: patch
// modify a given user
MATCH (u:user)
WHERE u.uid = {uid} OR u.username = {uid}
WITH u LIMIT 1
MATCH (u)-[:subscribed_to]->(pro:Project {uid:{Project}})
WITH u
SET
  u.last_modified_time = {_exec_time},

  {{#password}}
  u.password = {password},
  u.salt     = {salt},
  {{/password}}

  u.last_modified_date = {_exec_date}
RETURN u
// name: get
// find an user given the email, optionally is connected to the project
MATCH (u:user {uid:{uid}})
RETURN u
