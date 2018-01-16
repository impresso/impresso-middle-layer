const users = require('./users/users.service.js');
const articles = require('./articles/articles.service.js');
const entities = require('./entities/entities.service.js');
const timeline = require('./timeline/timeline.service.js');
const newspapers = require('./newspapers/newspapers.service.js');
const issues = require('./issues/issues.service.js');
const suggestions = require('./suggestions/suggestions.service.js');
module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars
  app.configure(users);
  app.configure(timeline);
  app.configure(articles);
  app.configure(entities);

  app.configure(newspapers);
  app.configure(issues);
  app.configure(suggestions);
};
