import { ImpressoApplication } from '../types';
import { logger } from '../logger';

const publicApiServices = ['search', 'articles', 'users', 'collectable-items', 'collections'];
const internalApiServices = [
  'users',
  'entities',
  'newspapers',
  'issues',
  'suggestions',
  'projects',
  'pages',
  'tags',
  'version',
  'articles-tags',
  'buckets-items',
  'search-exporter',
  'topics',
  'init',
  'pages-timelines',
  'issues-timelines',
  'articles-timelines',
  'jobs',
  'logs',
  'images',
  'articles-suggestions',
  'uploaded-images',
  'mentions',
  'filepond',
  'embeddings',
  'search-facets',
  'table-of-contents',
  'search-queries-comparison',
  'me',
  'search-queries',
  'errors-collector',
  'ngram-trends',
  'topics-graph',
  'articles-text-reuse-passages',
  'text-reuse-clusters',
  'text-reuse-cluster-passages',
  'text-reuse-passages',
  'filters-items',
  'stats',
  'articles-recommendations',
  'articles-search',
  'entities-suggestions',
  'entity-mentions-timeline',
  'text-reuse-connected-clusters',
  'password-reset',
];

export default (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi');
  const services = isPublicApi ? publicApiServices : publicApiServices.concat(internalApiServices);

  logger.info(`Loading services: ${services.join(', ')}`);

  services.forEach((service: string) => {
    const path = `./${service}/${service}.service`;
    const module = require(path);
    app.configure(module);
  });
};
