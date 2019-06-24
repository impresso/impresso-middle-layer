const config = require('@feathersjs/configuration')()();
const debug = require('debug')('impresso/hooks:access-rights');
const { ACCESS_RIGHTS_CLOSED } = require('../models/issues.model');

debug('init hook config:', config.accessRights);

/**
 * Given an article, check the access rights of the related issue;
 * delete the excerpt and the content if the user has not signed an NDA or
 * is anonymous.
 *
 * @param  { Article } article from results
 * @return { Article }         article, obfuscated
 */
const obfuscateArticleMapper = (article) => {
  if (!config.accessRights.showExcerpt) {
    article.excerpt = '... *** ...';
  }
  article.content = '... *** ...';
  return article;
};

/**
 * Given a result of articles, check the access rights of the related issue;
 * delete the excerpt and the content if the user has not signed an NDA or
 * is anonymous.
 *
 * @param  { context } context from results
 * @return { Function }         hook function
 */
const obfuscate = () => (context) => {
  if (!context.result) {
    throw new Error('The \'obfuscate\' hook should be used as a final hook.');
  }
  // should the content be obfuscated?
  context.obfuscated = !context.params.authenticated;

  if (context.obfuscated) {
    // NOT authenticated? let's obfuscate if the related issue has access-right: closed
    if (context.result.data) {
      for (let i = 0, l = context.result.data.length; i < l; i += 1) {
        if (context.result.data[i].issue.accessRights === ACCESS_RIGHTS_CLOSED) {
          context.result.data[i] = obfuscateArticleMapper(context.result.data[i]);
        }
      }
      debug('context result data obfuscated.');
    } else if (context.result.issue.accessRights === ACCESS_RIGHTS_CLOSED) {
      context.result = obfuscateArticleMapper(context.result);
      debug(`context result for id ${context.result.uid} obfuscated.`);
    }
  }
};

module.exports = {
  obfuscate,
};
