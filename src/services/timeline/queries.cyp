// name: entity_timeline_by_year
// year
MATCH (ent:entity {Project: {Project}, uid:{uid}})-[:appears_in]->(n:article)-[:happens_in]->(y:Year)
RETURN y.year as t, count(n) as w order by t

// name: entities_timeline_by_year
// year
MATCH (ent:entity {Project: {Project}})-[:appears_in]->(n:article)-[:happens_in]->(m:Year)
RETURN m.year as t, count(ent) as w order by t

// name: entities_timeline_by_month
// year
MATCH (ent:entity {Project: {Project})-[:appears_in]->(n:article)-[:happens_in]->(m:Month)
RETURN m.uid as t, count(n) as w order by t


// name: entity_timeline_by_month
// year
MATCH (ent:entity {Project: {Project}, uid:{uid}})-[:appears_in]->(n:article)-[:happens_in]->(m:Month)
RETURN m.uid as t, count(n) as w order by t

// name: article_timeline_by_year
// number of article per year. filter to be specified.
MATCH (art:article)-[:happens_in]->(y:Year)
RETURN y.year as t, count(art) as w order by t