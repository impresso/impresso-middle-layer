// Initializes the `entities-mentions` service on path `/entities-mentions`
const { EntitiesMentions } = require('./entities-mentions.class');
const hooks = require('./entities-mentions.hooks');

module.exports = function (app) {
  app.use('/entities-mentions', new EntitiesMentions(app));
  app.service('entities-mentions').hooks(hooks);
};
