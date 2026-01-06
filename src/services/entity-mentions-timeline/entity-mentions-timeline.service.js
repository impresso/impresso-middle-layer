import { EntityMentionsTimeline } from './entity-mentions-timeline.class.js'
import hooks from './entity-mentions-timeline.hooks.js'

export default function (app) {
  app.use('/entity-mentions-timeline', new EntityMentionsTimeline(app))
  app.service('entity-mentions-timeline').hooks(hooks)
}
