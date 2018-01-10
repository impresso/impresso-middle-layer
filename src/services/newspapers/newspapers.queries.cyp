// name: find
// 
MATCH (n:newspaper {Project:{Project}})
WITH count(n) as total
MATCH (news:newspaper {Project:{Project}})
RETURN news, total
ORDER BY news.df DESC
SKIP {skip}
LIMIT {limit}

// name: get
//
MATCH (news:newspaper {Project:{Project}, uid:{uid}})
RETURN news