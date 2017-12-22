
// name: find_entities
// useless :)
MATCH (n:entity {Project:{Project}})
WITH count(n) as total
MATCH (ent:entity {Project:{Project}})
RETURN ent, total
ORDER BY ent.df DESC
LIMIT {limit}

// name: get_entity
//
MATCH (ent:entity {Project:{Project}, uid:{uid}})
RETURN ent

// name: get_location
//
MATCH (loc:entity:location {Project:{Project}, uid:{uid}})
RETURN loc


// name: set_df
// Set Document Frequency property.
MATCH (n:entity {Project:{Project}})-[r:appears_in]->() WITH n, count(r) as df SET n.df = df
