const debug = require('debug')('impresso/multer');
const multer = require('multer');

const getMulterClient = (config) => {
  const client = multer(config);
  return client;
};
export default function (app) {
  const config = app.get('multer');
  app.set('multerClient', getMulterClient(config));
  debug('Multer is ready!');
};
