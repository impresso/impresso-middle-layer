import { IFetchClient, IFetchClientOptions } from './base.js'
import { BunFetchClient } from './bun.js'
import { FetchClient } from './node.js'

export const createFetchClient = (options: IFetchClientOptions): IFetchClient => {
  if (process.versions.bun) return new BunFetchClient(options)
  return new FetchClient(options)
}
