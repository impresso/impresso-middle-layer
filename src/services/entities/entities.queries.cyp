
// name: find
// 
MATCH (pro:Project {uid:{Project}})
WITH pro.count_entity as total
MATCH (ent:entity {Project:{Project}})
RETURN ent, total
ORDER BY ent.df DESC
SKIP {skip}
LIMIT {limit}

// name: find_as_q
// // if a parameter _q is found. 


// name: get
//
MATCH (ent:entity {Project:{Project}, uid:{uid}})
RETURN ent


// name: set_df
// Set Document Frequency property.
MATCH (n:entity {Project:{Project}})-[r:appears_in]->() WITH n, count(r) as df SET n.df = df
