// name: find
//
MATCH (pro:Project {uid:{Project}})
WITH COALESCE(pro.count_newspaper,0) as _total
MATCH (news:newspaper {Project:{Project}})
RETURN news, _total
SKIP {skip}
LIMIT {limit}

// name: findAll
// find all matching uids
MATCH (news:newspaper)
WHERE news.uid IN {uids} AND news.Project = {Project}
RETURN news

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

// name: merge
//
MERGE (news:newspaper {Project:{Project}, uid:{uid}})
SET
  {{#holder}}
  news.holder     = {holder},
  {{/holder}}
  news.acronym    = {acronym},
  news.start_year = toInteger({start_year}),
  news.end_year   = toInteger({end_year}),
  news.delta_year = toInteger({delta_year}),
  {{#languages}}
  news.languages  = {languages},
  {{/languages}}
  news.name       = {name}
  {{!,
  news.subtitle   = {subtitle},
  news.url        = {url},
  news.status     = {status},
  news.expected_raw_issues   = toInteger({expected_raw_issues}),
  news.expected_issues       = toInteger({expected_issues}),
  news.expected_raw_pages    = toInteger({expected_raw_pages}),
  news.expected_pages        = toInteger({expected_pages}),
  news.geographical_outreach = {geographical_outreach},
  news.periodicity           = {periodicity},
  news.political_orientation = {political_orientation},
  news.editor     = {editor},
  news.founder    = {founder},
  news.topics     = {topics},
  news.name       = {name},
  news.acronym    = {acronym}
  }}
RETURN news
