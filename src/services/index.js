const users = require('./users/users.service.js');
const articles = require('./articles/articles.service.js');
const entities = require('./entities/entities.service.js');
const timeline = require('./timeline/timeline.service.js');
const newspapers = require('./newspapers/newspapers.service.js');
const issues = require('./issues/issues.service.js');
const suggestions = require('./suggestions/suggestions.service.js');
const projects = require('./projects/projects.service.js');
const buckets = require('./buckets/buckets.service.js');
const queries = require('./queries/queries.service.js');
const pages = require('./pages/pages.service.js');
const tags = require('./tags/tags.service.js');
const version = require('./version/version.service.js');
const media = require('./media.js');
const proxy = require('./proxy.js');

const articlesTags = require('./articles-tags/articles-tags.service.js');
const bucketsItems = require('./buckets-items/buckets-items.service.js');

const search = require('./search/search.service.js');

const searchExporter = require('./search-exporter/search-exporter.service.js');

const collections = require('./collections/collections.service.js');

const collectableItems = require('./collectable-items/collectable-items.service.js');

const topics = require('./topics/topics.service.js');

const init = require('./init/init.service.js');

const pagesTimelines = require('./pages-timelines/pages-timelines.service.js');

const issuesTimelines = require('./issues-timelines/issues-timelines.service.js');

const articlesTimelines = require('./articles-timelines/articles-timelines.service.js');

const jobs = require('./jobs/jobs.service.js');

const logs = require('./logs/logs.service.js');

const images = require('./images/images.service.js');


const articlesSuggestions = require('./articles-suggestions/articles-suggestions.service.js');


const uploadedImages = require('./uploaded-images/uploaded-images.service.js');


const mentions = require('./mentions/mentions.service.js');


const filepond = require('./filepond/filepond.service.js');


const embeddings = require('./embeddings/embeddings.service.js');


module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars

  app.configure(users);
  app.configure(timeline);
  app.configure(buckets);
  app.configure(bucketsItems);
  app.configure(articles);
  app.configure(articlesTags);
  app.configure(entities);
  app.configure(newspapers);
  app.configure(issues);
  app.configure(suggestions);
  app.configure(projects);
  app.configure(queries);
  app.configure(pages);
  app.configure(tags);
  app.configure(version);


  app.configure(proxy);
  app.configure(search);
  app.configure(searchExporter);
  app.configure(collections);
  app.configure(collectableItems);
  app.configure(topics);
  app.configure(init);
  app.configure(pagesTimelines);
  app.configure(issuesTimelines);
  app.configure(articlesTimelines);
  app.configure(jobs);
  app.configure(logs);
  app.configure(images);
  app.configure(media);
  app.configure(entities);
  app.configure(articlesSuggestions);
  app.configure(uploadedImages);
  app.configure(mentions);
  app.configure(filepond);
  app.configure(embeddings);
};
