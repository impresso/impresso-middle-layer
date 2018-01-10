// name: find
// 
MATCH (n:issue {Project:{Project}})
WITH count(n) as total
MATCH (iss:issue {Project:{Project}})
WITH iss, total
// collect data
ORDER BY iss.date DESC
SKIP {skip}
LIMIT {limit}
MATCH (iss)<-[:belongs_to]-(pag:page {Project:{Project}})
WITH iss, total, collect(pag) as pages
RETURN {
  uid: iss.uid,
  year: iss.year,
  date: iss.date,
  pages: pages
} as iss, total
ORDER BY iss.date DESC


// name: get
//
MATCH (iss:issue {Project:{Project}, uid:{uid}})
RETURN iss