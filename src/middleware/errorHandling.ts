import type { Application as ExpressApplication } from '@feathersjs/express';
import type { Request, Response } from 'express';
import type { GeneralError } from '@feathersjs/errors';

import { errorHandler } from '@feathersjs/express';
import type { ImpressoApplication } from '../types';
import { logger } from '../logger';

export default (app: ImpressoApplication & ExpressApplication) => {
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(
    errorHandler({
      json: {
        404: (err: GeneralError, req: Request, res: Response) => {
          delete err.stack;
          res.json({ message: 'Not found' });
        },
        500: (err: GeneralError, req: Request, res: Response) => {
          if (isProduction) {
            delete err.stack;
          } else {
            logger.error('Error [500]', err);
          }
          res.json({ message: 'service unavailable' });
        },
        // unauthentified
        401: (err: GeneralError, req: Request, res: Response) => {
          res.json({
            message: err.message,
            name: err.name,
            code: err.code,
          });
        },
        // bad request
        400: (err: GeneralError, req: Request, res: Response) => {
          if (isProduction) {
            delete err.stack;
          } else {
            logger.error('Error [400]', err.data || err);
          }
          res.json({
            message: err.message || 'Please check request params',
            name: err.name,
            code: err.code,
            errors: err.data,
          });
        },
        default: (err: GeneralError, req: Request, res: Response) => {
          // handle all other errors
          logger.error('Error [default]', err);
          delete err.stack;
          res.json({ message: err.message });
        },
      },
    })
  );
};
