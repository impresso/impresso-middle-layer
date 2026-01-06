import { ImpressoApplication } from '@/types.js'
import { BaristaProxy } from '@/services/barista-proxy/barista-proxy.class.js'
import hooks from '@/services/barista-proxy/barista-proxy.hooks.js'

export default function (app: ImpressoApplication) {
  app.use('/barista-proxy', new BaristaProxy(app.get('features')?.barista!))
  app.service('barista-proxy').hooks(hooks)
}
