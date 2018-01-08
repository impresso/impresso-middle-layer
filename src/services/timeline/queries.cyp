// name: timeline_by_year
// year
MATCH (ent:entity {Project: {Project}, uid:{uid}})-[:appears_in]->(n:article)-[:happens_in]->(y:Year)
RETURN y.name as t, count(n) as w order by t

// name: timeline_by_month
// year
MATCH (ent:entity {Project: {Project}, uid:{uid}})-[:appears_in]->(n:article)-[:happens_in]->(m:Month)
RETURN m.uid as t, count(n) as w order by t