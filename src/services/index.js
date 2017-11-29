const users = require('./users/users.service.js');
const articles = require('./articles/articles.service.js');
const entities = require('./entities/entities.service.js');
module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars
  app.configure(users);
  app.configure(articles);
  app.configure(entities);
};
