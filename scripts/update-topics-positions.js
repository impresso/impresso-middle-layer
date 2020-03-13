const fs = require('fs');
const debug = require('debug')('impresso/scripts:update-topics-positions');
const Graph = require('graphology');
const forceAtlas2 = require('graphology-layout-forceatlas2');
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
    }))).reduce((acc, d) => acc.concat(d), []),
});

debug('Number of nodes', graph.order);
debug('Number of edges', graph.size);

// assigni initial xy
circular.assign(graph);
const positions = forceAtlas2(graph, {
  iterations: 50,
  settings: {
    gravity: 10,
  },
});

Object.keys(positions).forEach((uid) => {
  topics[uid].x = positions[uid].x;
  topics[uid].y = positions[uid].y;
});

const filename = './data/topics.json';

fs.writeFileSync(filename, JSON.stringify(topics));
debug(`success, saved ${filename}`);
