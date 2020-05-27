// @ts-check
const { default: fetch } = require('node-fetch');
const wdk = require('wikidata-sdk');
const debug = require('debug')('impresso/services:wikidata');
const lodash = require('lodash');

const IS_INSTANCE_OF = 'P31';
const IS_HUMAN = 'Q5';
// const IS_FICTIONAL_HUMAN = 'Q15632617';
const PLACE_COUNTRY = 'P17';
const PLACE_COORDINATES = 'P625';
// const PLACE_ADMIN_AREA = 'P131';


class NamedEntity {
  constructor({
    id = '',
    type = '',
    labels = [],
    descriptions = [],
    claims = {},
  } = {}) {
    this.id = String(id);
    this.type = String(type);
    this.labels = labels;
    this.descriptions = descriptions;
    this._pendings = {};

    if (Array.isArray(claims.P18)) {
      this.images = claims.P18.map(d => ({
        value: d.mainsnak.datavalue.value,
        rank: d.rank,
        datatype: d.mainsnak.datatype,
      }));
    } else {
      this.images = [];
    }
  }

  addPending(property, id) {
    if (!this._pendings[id]) {
      this._pendings[id] = [];
    }
    this._pendings[id].push(property);
  }

  getPendings() {
    return Object.keys(this._pendings);
  }

  resolvePendings(entities) {
    // console.log('RESOLVE', entities, this.getPendings());
    debug(`resolvePendings for ${this.id}`);
    this.getPendings().forEach((id) => {
      if (entities[id]) {
        this._pendings[id].forEach((property) => {
          this[property] = entities[id];
        });
      }
    });
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      labels: this.labels,
      descriptions: this.descriptions,
      images: this.images,
    };
  }
}

class Location extends NamedEntity {
  constructor({
    id = '',
    claims = {},
    labels = [],
    descriptions = [],
  } = {}) {
    super({
      id,
      claims,
      labels,
      descriptions,
      type: 'location',
    });

    //
    // this.coordinates = {
    //  "latitude": 45.566666666667,
    //  "longitude": 8.9333333333333,
    //  "altitude": null,
    //  "precision": 0.00027777777777778,
    // }
    this.coordinates = lodash.get(
      claims,
      `${PLACE_COORDINATES}[0].mainsnak.datavalue.value`,
    );

    this.country = lodash.get(
      claims,
      `${PLACE_COUNTRY}[0].mainsnak.datavalue.value`,
    );

    if (this.country && this.country.id) {
      this.addPending('country', this.country.id);
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      coordinates: this.coordinates,
      country: this.country,
      adminArea: this.adminArea,
    };
  }
}

/**
 *
 * [parseHuman description]
 * @param  {[type]} const [description]
 * @return {[type]}       [description]
 */
class Human extends NamedEntity {
  constructor({
    id = '',
    claims = {},
    labels = [],
    descriptions = [],
  } = {}) {
    super({
      id,
      claims,
      labels,
      descriptions,
      type: 'human',
    });

    this.birthDate = lodash.get(
      claims,
      'P569[0].mainsnak.datavalue.value.time',
    );

    this.deathDate = lodash.get(
      claims,
      'P570[0].mainsnak.datavalue.value.time',
    );

    // get related entities: birthPlace, deathPlace,
    this.birthPlace = lodash.get(
      claims,
      'P19[0].mainsnak.datavalue.value',
    );

    this.deathPlace = lodash.get(
      claims,
      'P20[0].mainsnak.datavalue.value',
    );

    if (this.birthPlace && this.birthPlace.id) {
      this.addPending('birthPlace', this.birthPlace.id);
    }

    if (this.deathPlace && this.deathPlace.id) {
      this.addPending('deathPlace', this.deathPlace.id);
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      birthDate: this.birthDate,
      deathDate: this.deathDate,
      birthPlace: this.birthPlace,
      deathPlace: this.deathPlace,
    };
  }
}


const getNamedEntityClass = (entity) => {
  const iof = lodash.get(
    entity.claims,
    `${IS_INSTANCE_OF}[0]mainsnak.datavalue.value.id`,
  );
  debug('getNamedEntityClass: iof', iof);
  if (iof === IS_HUMAN) {
    return Human;
  }

  if (entity.claims[PLACE_COORDINATES]) {
    return Location;
  }
  return NamedEntity;
};


/**
 * Return a new Entity intance with the correct subclass
 * @param  {NamedEntity} entity [description]
 * @return {any}        [description]
 */
const createEntity = (entity) => {
  // parse with wikidata sdk
  const simplified = wdk.simplify.entity(entity);
  const Klass = getNamedEntityClass(entity);
  // should be done with Proxy objects indeed
  return new Klass({
    ...simplified,
    claims: entity.claims,
  });
};

const resolve = async ({
  ids = [],
  languages = ['en', 'fr', 'de', 'it'], // platform languages
  depth = 0,
  maxDepth = 1,
  cache = null,
} = {}) => {
  // check wikidata in redis cache
  let cached;
  const cacheKey = `wkd:${ids.join(',')}`;

  if (cache) {
    cached = await cache.get(cacheKey);
    if (cached) {
      debug('cache found for cacheKey:', cacheKey);
      return JSON.parse(cached);
    }
    debug('no cache found for cacheKey:', cacheKey);
    // check cacheKey
  }
  // get wikidata api url for the given ids and the given anguage
  const url = wdk.getEntities(ids, languages);
  debug(`resolve: url '${url}', depth: ${depth}`);

  const result = await fetch(url)
    .then((res) => {
      if (res.ok) return res.json();
      throw new Error(res.statusText);
    })
    .then((res) => {
      const entities = {};
      let pendings = [];

      Object.keys(res.entities).forEach((id) => {
        entities[id] = createEntity(res.entities[id]);
        pendings = pendings.concat(entities[id].getPendings());
      });

      return {
        entities,
        pendings,
      };
    });

  let index;

  if (result.pendings.length && depth < maxDepth) {
    // enrich current entities with resolved pendings
    const resolvedPendings = await resolve({
      ids: lodash.uniq(result.pendings),
      depth: depth + 1,
      maxDepth,
      languages,
      cache,
    });
    debug(`resolve: with ${Object.keys(resolvedPendings).length} pending entities`);

    // console.log(resolvedPendings);
    index = lodash.mapValues(result.entities, (d) => {
      d.resolvePendings(resolvedPendings);
      return d.toJSON();
    });
  } else {
    index = lodash.mapValues(result.entities, d => d.toJSON());
  }

  if (cache) {
    // save
    debug('saving results in cache');
    await cache.set(cacheKey, JSON.stringify(index));
  }

  return index;
};

module.exports = {
  resolve,

};
