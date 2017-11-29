// name: find
//
MATCH (mem:memorialc:memo)
RETURN mem
LIMIT {limit}

// name: create
//
MERGE (mem:memorialc:memo {uid:{uid}})
SET mem.year = {year}
RETURN mem
