import { ImpressoApplication } from '../../types'

import Service from './feedback-collector.class'
import hooks from './feedback-collector.hooks'

export default function (app: ImpressoApplication) {
  app.use('/feedback-collector', new Service())
  app.service('feedback-collector').hooks(hooks)
}
