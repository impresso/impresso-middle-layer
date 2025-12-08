import Debug from 'debug'
import { optionsDisabledInPublicApi } from '../../hooks/public-api'
import { ImpressoApplication } from '../../types'
import createService from './logs.class'

const debug = Debug('impresso/services:logs')

export default function (app: ImpressoApplication) {
  debug('Registering logs service')
  app.use('/logs', createService(), optionsDisabledInPublicApi(app))
}
