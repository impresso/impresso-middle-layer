import { ImpressoApplication } from '../types';
import { logger } from '../logger';
import media from './media';
import proxy from './proxy';

const publicApiServices = ['search', 'articles'];
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
  'collections',
  'collectable-items',
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
  console.log('ooo', publicApiServices);
  const services = isPublicApi ? publicApiServices : publicApiServices.concat(internalApiServices);

  logger.info(`Loading services: ${services.join(', ')}`);

  services.forEach((service: string) => {
    const path = `./${service}/${service}.service`;
    const module = require(path);
    app.configure(module);
  });
  app.configure(media);
  app.configure(proxy);
};
