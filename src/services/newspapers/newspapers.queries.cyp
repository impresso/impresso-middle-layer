// name: find
//
MATCH (pro:Project {uid:{Project}})
WITH COALESCE(pro.count_newspaper,0) as _total
MATCH (news:newspaper {Project:{Project}})
RETURN news, _total
SKIP {skip}
LIMIT {limit}

// name: get
//
MATCH (news:newspaper {Project:{Project}, uid:{uid}})
RETURN news


// name: count
//
MATCH (news:newspaper {Project:{Project}})
WITH count(news) as count_newspaper
MATCH (pro:Project {uid:{Project}})
SET pro.count_newspaper = count_newspaper
RETURN count_newspaper
