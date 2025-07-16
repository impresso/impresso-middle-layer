import { ImpressoProxy } from '../models/generated/common'

const SocketConfigurationEnvFileName = 'IMPRESSO_SOCKS_PROXY_CONFIG'

export const getSocksProxyConfiguration = (method = 'env'): ImpressoProxy | undefined => {
  if (method !== 'env') {
    throw new Error('Unsupported method for getting SOCKS proxy configuration')
  }

  const socksProxyConfigString = process.env[SocketConfigurationEnvFileName]
  if (!socksProxyConfigString) {
    return undefined
  }
  try {
    const socksProxyConfig: ImpressoProxy = JSON.parse(socksProxyConfigString)
    return socksProxyConfig
  } catch (error) {
    console.error('Error parsing SOCKS proxy configuration:', error)
    return undefined
  }
}

export const shouldUseSocksProxy = (domainOrUri: string, proxyConfig: ImpressoProxy | undefined): boolean => {
  if (!proxyConfig) {
    return false
  }
  const { host, port } = proxyConfig
  if (!host || !port) {
    return false
  }

  let domain = domainOrUri
  try {
    domain = new URL(domainOrUri).hostname
  } catch (e) {
    /** */
  }
  if (proxyConfig.domains && proxyConfig.domains.length > 0) {
    return proxyConfig.domains.includes(domain)
  }
  return false
}
