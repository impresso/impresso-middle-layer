import Debug from 'debug'
const debug = Debug('impresso/multer')
import multer from 'multer'

const getMulterClient = config => {
  const client = multer(config)
  return client
}
export default function (app) {
  const config = app.get('multer')
  app.set('multerClient', getMulterClient(config))
  debug('Multer is ready!')
}
