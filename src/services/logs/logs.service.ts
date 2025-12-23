import Debug from 'debug'
import { optionsDisabledInPublicApi } from '@/hooks/public-api.js'
import { ImpressoApplication } from '@/types.js'
import createService from '@/services/logs/logs.class.js'

const debug = Debug('impresso/services:logs')

export default async function (app: ImpressoApplication) {
  debug('Registering logs service')
  app.use('/logs', await createService(), optionsDisabledInPublicApi(app))
}
