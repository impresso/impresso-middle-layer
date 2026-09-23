import { optionsDisabledInPublicApi } from '@/hooks/public-api.js'
import { getLogger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'
import createService from '@/services/logs/logs.class.js'

const logger = getLogger(['impresso', 'services', 'logs'])

export default function (app: ImpressoApplication) {
  logger.debug('Registering logs service')
  app.use('/logs', createService(), optionsDisabledInPublicApi(app))
}
