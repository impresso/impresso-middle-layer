
// name: find
//
MATCH (pro:Project {uid:{Project}})
WITH COALESCE(pro.count_entity, 0) as _total
MATCH (ent:entity {Project:{Project}})
RETURN ent, _total
ORDER BY ent.df DESC
SKIP {skip}
LIMIT {limit}

// name: find_as_q
// // if a parameter _q is found.


// name: get
//
MATCH (ent:entity {Project:{Project}, uid:{uid}})
RETURN ent


// name: count
// store count_entity in current Project node.
// TASK=run_query QUERIES=./src/services/entities/entities.queries.cyp NAME=count npm run cli
MATCH (ent:entity {Project:{Project}})
WITH count(ent) as count_entity
MATCH (pro:Project {uid:{Project}})
SET pro.count_entity = count_entity
RETURN count_entity


// name: APOC_set_entity_df
// calculate and store **Document frequency** per entity in general
// TASK=run_query QUERIES=./src/services/entities/entities.queries.cyp NAME=APOC_set_entity_df npm run cli
CALL apoc.periodic.iterate(
  "MATCH (ent:entity {Project:{Project}}) RETURN ent",
  "MATCH (ent)-[r:appears_in]->() WITH ent, count(r) as df SET ent._df = df",
  {batchSize:500, iterateList:true, parallel:true, params:{Project: {Project}}})
