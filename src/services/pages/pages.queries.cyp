// name: setup
// constraints
CREATE CONSTRAINT ON (p:page) ASSERT p.uid IS UNIQUE

// name: find
// all pages related to one issue or a generic list of pages
{{#issue__uid}}
MATCH (p:page)-[:belongs_to]->(iss:issue {uid:{issue__uid}})
WHERE p.Project = {Project}
WITH p, COALESCE(iss.count_pages, -1) as _total
{{/issue__uid}}

{{^issue__uid}}
MATCH (pro:Project {uid: {Project}})
WITH COALESCE(pro.count_pages, -1) as _total
MATCH (p:page)
WHERE p.Project = {Project}
WITH p, _total
{{/issue__uid}}

SKIP {skip}
LIMIT {limit}
RETURN p, _total

// name: get
//
MATCH (p:page {uid:{uid}})<-[:appears_at]-(art:article)
WITH p, collect(art) as _related_articles
MATCH (p)<-[:appears_at]-(art:article)
WITH p,_related_articles, art
OPTIONAL MATCH P=(art)<-[r:appears_in]-(ent:entity)
WITH p, _related_articles, P
ORDER BY r.ntf DESC
SKIP 0
LIMIT 10
return p, _related_articles, P as _related_entities
