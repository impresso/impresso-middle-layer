import { IFetchClient, IFetchClientOptions } from './base'
import { BunFetchClient } from './bun'
import { FetchClient } from './node'

export const createFetchClient = (options: IFetchClientOptions): IFetchClient => {
  if (process.versions.bun) return new BunFetchClient(options)
  return new FetchClient(options)
}
