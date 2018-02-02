// name: find
// 
MATCH (pro:Project {uid:{Project}})
WITH pro.count_newspaper as total
MATCH (news:newspaper {Project:{Project}})
RETURN news, total
ORDER BY news.df DESC
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