import Debug from 'debug'
const debug = Debug('impresso/services:logs')

export type LogData = {
  task?: string //  'TES',
  taskname?: string // 'impresso.tasks.test_progress',

  from: string
  to: string
  msg: string
  job?: any
}

/**
 * DEBUG=impresso/services:logs,impresso/celery npm run dev
 * @class Service
 * @description A service class for handling log entries.
 */
export class Service {
  async create(data: LogData): Promise<any> {
    debug('Creating log entry for', data)
    return {
      ...data,
      from: data.from || 'unknown',
      to: data.to || '*',
    }
  }
}

export default function () {
  return new Service()
}
