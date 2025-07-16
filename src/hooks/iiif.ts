import type { HookContext } from '@feathersjs/feathers'
import Debug from 'debug'
import type { ImpressoApplication } from '../types'

type ProxyConfig = any

const debug = Debug('impresso/hooks:iiif')

const iiifMapper = (d: Record<string, any>, proxyConfig: ProxyConfig) => {
  const _d = {
    ...d,
  }
  const host = proxyConfig?.host ?? ''

  if (d.pageUid && Array.isArray(d.coords)) {
    // fragments matches from SOLR
    _d.iiif_fragment = `${host}/proxy/iiif/${d.pageUid}/${d.coords.join(',')}/max/0/default.png`
    _d.iiifFragment = _d.iiif_fragment
  } else if (!d.labels) {
    // non canonical neo4j objects, ignore...
  } else if (d.labels.indexOf('issue') !== -1 && d.cover && d.cover.uid) {
    // issue with cover page ;)
    _d.iiif = `${host}/proxy/iiif/${d.cover.uid}`
    _d.iiifThumbnail = `${host}/proxy/iiif/${d.cover.uid}/full/350,/0/default.png`
    _d.cover.iiif = `${host}/proxy/iiif/${d.cover.uid}`
    _d.cover.iiifThumbnail = `${host}/proxy/iiif/${d.cover.uid}/full/150,/0/default.png`
  } else if (d.labels.indexOf('page') !== -1) {
    _d.iiif = `${host}/proxy/iiif/${d.uid}`
    _d.iiifThumbnail = `${host}/proxy/iiif/${d.uid}/full/150,/0/default.png`
  } else if (d.labels.indexOf('iassignIIIFssue') !== -1 && typeof d.cover === 'string') {
    _d.iiif = `${host}/proxy/iiif/${d.cover}`
    _d.iiifThumbnail = `${host}/proxy/iiif/${d.cover}/full/350,/0/default.png`
  }
  return _d
}

/**
 * @deprecated Not used in any working code.
 */
const assignIIIF =
  (...resultProperties: string[]) =>
  async (context: HookContext<ImpressoApplication>) => {
    if (!context.result) throw new Error("The 'assignIIIF' hook should only be used with a defined context.result")
    if (context.type != 'after') throw new Error("The 'assignIIIF' hook should be used as an after hook only")

    const proxyConfig = context.app.get('proxy' as any) ?? {}

    const _recursiveReplace = (d: Record<string, any>) => {
      const _d = iiifMapper(d, proxyConfig)

      resultProperties.forEach(key => {
        if (_d[key]) {
          if (Array.isArray(_d[key])) {
            _d[key] = _d[key].map(item => iiifMapper(item, proxyConfig))
          } else if (_d[key].constructor.name === 'Object') {
            _d[key] = iiifMapper(_d[key], proxyConfig)
          }
        }
      })
      return _d
    }
    if (context.method === 'find' && context.result.data && context.result.data.length) {
      debug(
        `proxy: <n. results>: ${context.result.data.length} <host>: ${proxyConfig.host}, <keys>: ${resultProperties}`
      )
      context.result.data = context.result.data.map(_recursiveReplace)
    } else if (context.method === 'get' && typeof context.result.uid !== 'undefined') {
      debug(`proxy: <uid>: ${context.result.uid} <host>: ${proxyConfig.host}, <keys>: ${resultProperties}`)
      context.result = _recursiveReplace(context.result)
    }
  }
