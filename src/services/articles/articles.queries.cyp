// name: find
// we use the property count_article STORED on current Project. @todo: check if user has access to the project.
MATCH (pro:Project {uid:{Project}})
WITH pro.count_article as total
MATCH (art:article {Project:{Project}})
WITH art, total
{{#order_by}}
ORDER BY {order_by}
{{/order_by}}

SKIP {skip}
LIMIT {limit}

WITH art, total
MATCH (art)-[:appears_at]->(pag:page)
WITH art, total, collect(pag) as pages
RETURN {
  uid: art.uid,
  title: art.title,
  pages: pages
} as art, total


// name: get
//
MATCH (art:article {Project:{Project}, uid:{uid}})
RETURN art