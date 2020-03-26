const fs = require('fs');
const debug = require('debug')('impresso/scripts:update-topics-positions');
const Graph = require('graphology');
const forceAtlas2 = require('graphology-layout-forceatlas2');
const pagerank = require('graphology-pagerank');
const louvain = require('graphology-communities-louvain');
const { circular } = require('graphology-layout');
const topics = require('../data/topics.json');

const graph = new Graph();

graph.import({
  attributes: {
    name: 'the awesome topic graph',
  },
  nodes: Object.values(topics).map(topic => ({
    key: topic.uid,
    attributes: {
      weight: topic.countItems,
    },
  })),
  edges: Object.values(topics)
    .map(topic => topic.relatedTopics.map(rel => ({
      source: topic.uid,
      target: rel.uid,
      attributes: {
        weight: rel.w,
      },
    }))).reduce((acc, d) => acc.concat(d), []),
});

debug('Number of nodes', graph.order);
debug('Number of edges', graph.size);

// assigni initial xy
circular.assign(graph);
const positions = forceAtlas2(graph, {
  iterations: 5000,
  settings: {
    gravity: 50,
    linLogMode: true,
  },
});

const pageranks = pagerank(graph, { alpha: 0.9, weighted: true });
const communities = louvain(graph);
debug('pageranks', pageranks);
debug('communities', communities);
Object.keys(positions).forEach((uid) => {
  topics[uid].x = positions[uid].x;
  topics[uid].y = positions[uid].y;
  topics[uid].pagerank = pageranks[uid];
  topics[uid].community = communities[uid];
});

const filename = './data/topics.json';

fs.writeFileSync(filename, JSON.stringify(topics));
debug(`success, saved ${filename}`);
