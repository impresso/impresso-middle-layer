import { ImpressoApplication } from '@/types.js'

import Service from '@/services/feedback-collector/feedback-collector.class.js'
import hooks from '@/services/feedback-collector/feedback-collector.hooks.js'

export default function (app: ImpressoApplication) {
  app.use('/feedback-collector', new Service())
  app.service('feedback-collector').hooks(hooks)
}
