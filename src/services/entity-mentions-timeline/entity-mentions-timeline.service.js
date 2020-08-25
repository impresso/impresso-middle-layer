const { EntityMentionsTimeline } = require('./entity-mentions-timeline.class');
const hooks = require('./entity-mentions-timeline.hooks');

module.exports = function (app) {
  app.use('/entity-mentions-timeline', new EntityMentionsTimeline(app));
  app.service('entity-mentions-timeline').hooks(hooks);
};
