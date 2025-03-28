import { ImpressoApplication } from '../../types'
import { BaristaProxy } from './barista-proxy.class'
import hooks from './barista-proxy.hooks'

export default function (app: ImpressoApplication) {
  app.use('/barista-proxy', new BaristaProxy(app.get('barista')))
  app.service('barista-proxy').hooks(hooks)
}
