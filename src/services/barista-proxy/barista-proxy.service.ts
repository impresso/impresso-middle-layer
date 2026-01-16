import { ImpressoApplication } from '@/types.js'
import { BaristaProxy } from '@/services/barista-proxy/barista-proxy.class.js'
import hooks from '@/services/barista-proxy/barista-proxy.hooks.js'

export default function (app: ImpressoApplication) {
  app.use('/barista-proxy', new BaristaProxy(app, app.get('features')?.barista!), {
    events: ['barista-response'],
  })
  app.service('barista-proxy').hooks(hooks)

  // Publish barista-response events to authenticated users
  app.service('barista-proxy').publish('barista-response', (data: any, context: any) => {
    // Send to authenticated channel for logged-in users
    return app.channel('authenticated')
  })
}
