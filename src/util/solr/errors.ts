import { isSolrError, SolrError } from '@/solr'
import { BadRequest, GeneralError } from '@feathersjs/errors'

/**
 * Parse Solr error and convert it to a standard FetahtersJs error
 * with a sensible message.
 * @param error a solr or generic/other error.
 */
export function preprocessSolrError(error: Error | SolrError) {
  let code = 500
  let message = error.message

  try {
    if (isSolrError(error)) {
      const body = typeof error.response.body === 'string' ? JSON.parse(error.response.body) : error.response.body
      code = body.error.code
      // Solr parser dump after this line. Not useful.
      message = body.error.msg.replace(/\n/g, ' ').replace(/Was expecting one of:.*/, '')
    }
  } catch (e) {
    if (isSolrError(error)) {
      const excerpt = (
        typeof error.response.body === 'string' ? error.response.body : JSON.stringify(error.response.body)
      ).slice(0, 200)
      message = `${excerpt}...`
    }
  }

  if (code === 400) return new BadRequest(message)
  return new GeneralError(message)
}
