// name: setup
//
CREATE CONSTRAINT ON (iss:issue) ASSERT iss.uid IS UNIQUE
CREATE INDEX ON :issue(year)

// name: merge
// optionally merge with a newspaper_uid
MERGE (iss:issue {Project:{Project}, uid:{uid}})
SET
  iss.year = {year},
  iss.date = {date}
WITH iss
{{#newspaper_uid}}
MATCH (news:newspaper {Project:{Project}, uid:{newspaper_uid}})
MERGE (iss)-[r:belongs_to]->(news)
{{/newspaper_uid}}
RETURN iss

// name: find
//
MATCH (n:issue {Project:{Project}})
WITH count(n) as _total
MATCH (iss:issue {Project:{Project}})
WITH iss, _total
// collect data
ORDER BY iss.date DESC
SKIP {skip}
LIMIT {limit}
OPTIONAL MATCH (iss)<-[:belongs_to]-(pag:page {Project:{Project}, num:1})
WITH iss, _total, head(collect(pag)) as cover
RETURN iss, cover as _related_cover, _total
ORDER BY iss.date DESC


// name: get
//
MATCH (iss:issue {Project:{Project}, uid:{uid}})
WHERE iss.Project = 'impresso'
WITH iss
OPTIONAL MATCH (iss)<-[:belongs_to]-(pag:page {Project:{Project}})
with iss, pag
ORDER BY pag.num ASC
WITH iss, collect(pag) as _related_pages
MATCH (iss)-[:belongs_to]->(news:newspaper)
WITH iss, _related_pages, news as _related_newspaper
LIMIT 1
OPTIONAL MATCH (iss)<-[:belongs_to]-(pag:page)<-[:appears_at]-(art:article)<-[r:appears_in]-(ent:entity)
WITH iss, _related_pages, _related_newspaper, r, ent
ORDER BY r.tf DESC
LIMIT 20

RETURN iss, _related_pages, _related_newspaper, collect(ent) as _related_entities
