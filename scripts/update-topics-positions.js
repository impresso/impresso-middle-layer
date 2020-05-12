const fs = require('fs');
const debug = require('debug')('impresso/scripts:update-topics-positions');
const Graph = require('graphology');
const forceAtlas2 = require('graphology-layout-forceatlas2');
const pagerank = require('graphology-pagerank');
const louvain = require('graphology-communities-louvain');
const hits = require('graphology-hits');
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
      x: topic.x,
      y: topic.y,
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

const { x, y } = graph.getNodeAttributes(graph.nodes()[1]);
debug('Get x y of the first node:', x, y);

if (!x && !y) {
  debug('No initial xy, do circular layout first.');
  circular.assign(graph);
}

const positions = forceAtlas2(graph, {
  iterations: 100,
  settings: {
    gravity: 20,
    linLogMode: false,
  },
});

const pageranks = pagerank(graph, { alpha: 0.9, weighted: true });
const communities = louvain(graph);
const { hubs, authorities } = hits(graph, { normalize: false });
// const degreesPerCommunity = groupBy(communities, 'uid');

debug('positions n.', Object.keys(pageranks).length);
debug('pageranks n.', Object.keys(pageranks).length);
debug('communities n.', Object.keys(communities).length);
debug('hubs n.', Object.keys(hubs).length);
debug('authorities n.', Object.keys(authorities).length);


Object.keys(positions).forEach((uid) => {
  topics[uid].x = positions[uid].x;
  topics[uid].y = positions[uid].y;
  topics[uid].pagerank = pageranks[uid];
  topics[uid].community = communities[uid];
  topics[uid].hub = hubs[uid];
  topics[uid].authority = authorities[uid];

  debug(
    'topic', uid,
    '- x y:', topics[uid].x, topics[uid].y,
    '- p:', topics[uid].pagerank,
    '- c:', topics[uid].community,
  );
});

const filename = './data/topics.json';

fs.writeFileSync(filename, JSON.stringify(topics));
debug(`success, saved ${filename}`);
