const {
  BadRequest, GeneralError,
} = require('@feathersjs/errors');

/**
 * Parse Solr error and convert it to a standard FetahtersJs error
 * with a sensible message.
 * @param {Error} error a `requests` error.
 */
function preprocessSolrError(error) {
  let message = '';
  try {
    if (typeof error.response.body === 'string') {
      message = JSON.parse(error.response.body).error.msg.replace(/\n/g, ' ');
      // Solr parser dump after this line. Not useful.
      message = message.replace(/Was expecting one of:.*/, '');
    } else {
      message = error.response.body.error.msg;
    }
  } catch (e) {
    message = `${error.response.body.slice(0, 200)}...`;
  }

  if (error.statusCode === 400) return new BadRequest(message);
  return new GeneralError(message);
}

module.exports = { preprocessSolrError };
