import Debug from 'debug'
const debug = Debug('impresso/services:logs')

export type LogData = {
  tasktype: string //  'TES',
  taskname: string // 'impresso.tasks.test_progress',
  taskstate: string // 'RUN',
  progress: number // 0,
  from: string
  to: string
  msg: string
  job?: any
  collection?: any
  query?: string
  sq?: string
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

export default async function () {
  return new Service()
}
