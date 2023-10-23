const { BadRequest, GeneralError } = require('@feathersjs/errors')

/**
 * Parse Solr error and convert it to a standard FetahtersJs error
 * with a sensible message.
 * @param {Error} error a `requests` error.
 */
function preprocessSolrError (error) {
  let message = ''
  let code = error.statusCode
  try {
    if (typeof error.response.body === 'string') {
      const body = JSON.parse(error.response.body)
      code = body.error.code
      message = body.error.msg.replace(/\n/g, ' ')
      // Solr parser dump after this line. Not useful.
      message = message.replace(/Was expecting one of:.*/, '')
      // porint out solr errors in the logs
      console.error('Solr error', message, body.responseHeader)
    } else {
      message = error.response.body.error.msg
      code = error.response.body.error.code
    }
  } catch (e) {
    if (error.response) {
      message = `${error.response.body.slice(0, 200)}...`
    } else {
      message = error.message
    }
  }

  if (code === 400) return new BadRequest(message)
  return new GeneralError(message)
}

module.exports = { preprocessSolrError }
