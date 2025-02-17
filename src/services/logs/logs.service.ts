import { ImpressoApplication } from '../../types'
import Debug from 'debug'
const debug = Debug('impresso/services:logs')
import createService from './logs.class'

export default function (app: ImpressoApplication) {
  debug('Registering logs service')
  app.use('/logs', createService())
}
