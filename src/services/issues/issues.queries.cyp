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
OPTIONAL MATCH (iss)<-[:belongs_to]-(pag:page {Project:{Project}, num:1})
WITH iss, total, head(collect(pag)) as cover
RETURN {
  uid: iss.uid,
  year: iss.year,
  date: iss.date,
  cover: cover
} as iss, total
ORDER BY iss.date DESC


// name: get
//
MATCH (iss:issue {Project:{Project}, uid:{uid}})
WITH iss
OPTIONAL MATCH (iss)<-[:belongs_to]-(pag:page {Project:{Project}})
with iss, pag
ORDER BY pag.num ASC
WITH iss, collect(pag) as pages
RETURN {
  uid: iss.uid,
  year: iss.year,
  date: iss.date,
  pages: pages
}
