const debug = require('debug')('impresso/helpers');
const verbose = require('debug')('verbose:impresso/helpers');
/**
 * Compare two tokens and check if they overlap
 * @param {Token} a in b
 * @param {Token} b
 */
const hasOverlaps = (a, b) => !(a.r <= b.l || a.l >= b.r);


// const lodash = require('lodash');
/**
 * create a markdown
 *
 * @param {string} uid text to cut
 *
 */
const annotate = (tokens, uid, left, right, attr = 'ref') => {
  debug(`annotate: ${attr}=${uid} (${left}, ${right})`);
  for (let i = 0, l = tokens.length; i < l; i += 1) {
    // is included, continue on the next line

    if (hasOverlaps({ l: left, r: right }, tokens[i])) {
      if (!tokens[i].ref) {
        tokens[i].ref = [];
      }
      tokens[i].attr = attr;
      tokens[i].ref.push({
        uid,
        l: left,
        r: right,
      });
    }
  }
};


const seek = (tokens, splitpoints) => {
  let offsetIndex = 0;
  const clusters = [];

  for (let i = 0, l = splitpoints.length; i < l; i += 1) {
    for (let j = offsetIndex, ll = tokens.length; j < ll; j += 1) {
      if (tokens[j].r > splitpoints[i]) {
        clusters.push({
          g: tokens.slice(offsetIndex, j),
          r: tokens[j - 1].r,
        });
        // console.log(tokens.slice(offsetIndex, j));
        offsetIndex = j;
        break;
      }
      // console.log(i, tokens[j].r, splitpoints[i], offsetIndex);
    }
  }
  // remaining.
  clusters.push({
    g: tokens.slice(offsetIndex - 1),
    r: tokens[tokens.length - 1].r,
  });
  return clusters;
};

/**
 * Cut a text according to splitpoints
 *
 * @param {string} text text to cut
 * @param {Array} splitpoints
 * @return array of chunks objects {t:'', r:124}
 */
const sliceAtSplitpoints = (text, splitpoints, origin = 0) => {
  if (!Array.isArray(splitpoints) || !splitpoints.length) {
    throw new Error('sliceAtIndices: the list of splitpoints is empty!');
  }
  verbose(`sliceAtIndices: text length of ${text.length} chars with ${splitpoints.length} splitpoints`);

  // initialize chunks with first splitpoint
  const chunks = [{
    t: text.slice(0, splitpoints[0] - origin),
    r: splitpoints[0],
    l: origin,
  }];

  // generate text splitpoints
  for (let i = 1, l = splitpoints.length; i < l; i += 1) {
    chunks.push({
      t: text.slice(splitpoints[i - 1] - origin, splitpoints[i] - origin),
      r: splitpoints[i],
      l: splitpoints[i - 1],
    });
  }

  // add final token
  chunks.push({
    t: text.slice(splitpoints[splitpoints.length - 1] - origin),
    r: text.length + origin,
    l: splitpoints[splitpoints.length - 1],
  });
  return chunks;
};

const getSplitpointsFromRefs = (refs, leftLimit, rightLimit) => {
  const indices = {};
  for (let i = 0, l = refs.length; i < l; i += 1) {
    if (refs[i].r < rightLimit) {
      indices[refs[i].r] = true;
    }
    if (refs[i].l < rightLimit && refs[i].l > leftLimit) {
      indices[refs[i].l] = true;
    }
  }
  return Object.keys(indices).map(d => parseInt(d, 10)).sort();
};

/**
 * @param {Array} tokens
 * @return tokens with merged annotations
 */
const render = (tokens) => {
  let md = [];
  // for each tockens, get all sliceAtSplitpoints
  for (let i = 0, l = tokens.length; i < l; i += 1) {
    if (tokens[i].g) {
      md = md.concat(render(tokens[i].g));
    } else if (tokens[i].ref) {
      // get all possible splitpoints based on REFS
      const splitpoints = getSplitpointsFromRefs(tokens[i].ref, tokens[i].l, tokens[i].r);
      // console.log('render', tokens[i].t, splitpoints, tokens[i].l);
      if (splitpoints.length) {
        // chunk text based on those splitpoints
        const chunks = sliceAtSplitpoints(tokens[i].t, splitpoints, tokens[i].l);

        // loop chunks in REFS to check which chunk contains exactly which ref
        for (let ii = 0, ll = chunks.length; ii < ll; ii += 1) {
          // console.log('... chunk: ', `'${chunks[ii].t}'`, chunks[ii].l, chunks[ii].r);

          for (let iii = 0, lll = tokens[i].ref.length; iii < lll; iii += 1) {
            if (hasOverlaps(tokens[i].ref[iii], chunks[ii])) {
              // console.log('      => found', tokens[i].ref[iii].l, tokens[i].ref[iii].r);
              if (!chunks[ii].ref) {
                chunks[ii].ref = [];
              }
              chunks[ii].attr = tokens[i].attr;
              chunks[ii].ref.push(tokens[i].ref[iii]);
            }
          }
        }

        md.push(chunks
          .map((c) => {
            if (!c.ref) {
              return c.t;
            }
            return `<span ${c.attr}="${c.ref.map(d => d.uid).join(' ')}">${c.t}</span>`;
          })
          .join(''));
      } else {
        // no splitpoints, no internal chunks.
        md.push(`<span ${tokens[i].attr}="${tokens[i].ref.map(d => d.uid).join(' ')}">${tokens[i].t}</span>`);
      }
    } else if (tokens[i].t) {
      md.push(tokens[i].t);
    }
  }
  return md;
};

/**
 * Cut a text according to splitpoints. Return a d3
 *
 * @param {Array} chunks array of text chunks with their righmost index
 * @param {Array} thresholds list of indices
 * @param {Array} otherThresholds optional, rest
 */
const toHierarchy = (chunks, thresholds, ...otherThresholds) => {
  debug(`toHierarchy: from ${chunks.length} chunks, ${thresholds.length} initital threshold, ${otherThresholds.length} additional lists of nodes`);

  let clusters = seek(chunks, thresholds);

  // recursively with remaining nodes, if any.
  otherThresholds.forEach((threshold) => {
    clusters = seek(clusters, threshold);
  });


  debug('toHierarchy: done.');
  return clusters;
};


module.exports = {
  toHierarchy,
  sliceAtSplitpoints,
  annotate,
  render,
};
