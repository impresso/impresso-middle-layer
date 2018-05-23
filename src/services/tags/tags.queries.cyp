// name: get
//

// name: find
//
MATCH (pro:Project {uid: {Project}})
WITH COALESCE(pro.count_tags, -1) as _total
MATCH (t:tag {Project:{Project}})
RETURN t, _total
SKIP {skip}
LIMIT {limit}

// name: setup
// constraints
CREATE CONSTRAINT ON (t:tag) ASSERT t.uid IS UNIQUE


// name: suggest
//


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
