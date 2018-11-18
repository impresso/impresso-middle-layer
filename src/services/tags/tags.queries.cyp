// name: get
//

// name: find
//
// 
MATCH (pro:Project {uid: {Project}})
WITH COALESCE(pro.count_tags, -1) as _total
{{#q}}
call apoc.index.search('tag_suggestions', {q})
  YIELD node, weight
RETURN node, weight as _weight, _total
ORDER BY _weight, node.df DESC
LIMIT {limit}
{{/q}}
{{^q}}
MATCH (t:tag {Project:{Project}})
RETURN t, _total
SKIP {skip}
LIMIT {limit}
{{/q}}

// name: setup
// constraints
CREATE CONSTRAINT ON (t:tag) ASSERT t.uid IS UNIQUE


// name: suggest
//
call apoc.index.search('tag_suggestions', {q})
  YIELD node, weight
  RETURN node, weight as _weight
  ORDER BY _weight, node.df DESC
  LIMIT {limit}


// name: merge
//
MERGE (tag:tag {Project:{Project}, uid:{uid}})
  ON CREATE SET
    tag.name = {name},
    {{#applies_to}}
    tag.applies_to = {applies_to},
    {{/applies_to}}
    tag.description = {description}
RETURN tag


// name: count
//
MATCH (t:tag {Project:{Project}})
WITH count(t) as count_tags
MATCH (pro:Project {uid: {Project}})
SET pro.count_tags = count_tags
RETURN pro.count_tags

// name: APOC_set_lucene_index
//
CALL apoc.index.addAllNodes('tag_suggestions',{
  tag: ["name"]
})
