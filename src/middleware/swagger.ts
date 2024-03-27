import swagger, { swaggerUI } from 'feathers-swagger';
import { logger } from '../logger';
import { ImpressoApplication } from '../types';

export default (app: ImpressoApplication) => {
  if (!app.get('isPublicApi')) {
    logger.info('Internal API - swagger middleware is disabled');
    return;
  }
  logger.info('Public API - swagger middleware is enabled');

  const swaggerItem = swagger({
    specs: {
      info: {
        title: 'Impresso Public API',
        description: 'Impresso Public API Documentation',
        version: require('../../package.json').version,
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
      security: [{ BearerAuth: [] }],
    },
    include: {
      // paths: [/^this$/],
    },
    ui: swaggerUI({}),
  });
  return app.configure(swaggerItem);
};
