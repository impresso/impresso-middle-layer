// name: find
// we use the property count_article STORED on current Project. @todo: check if user has access to the project.
MATCH (pro:Project {uid:{Project}})
WITH pro.count_article as total
MATCH (art:article {Project:{Project}})
RETURN art, total
SKIP {skip}
LIMIT {limit}

// name: get
//
MATCH (art:article {Project:{Project}, uid:{uid}})
RETURN art