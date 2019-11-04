const config = require('@feathersjs/configuration')()();
const debug = require('debug')('impresso/hooks:access-rights');
const { ACCESS_RIGHTS_CLOSED } = require('../models/issues.model');

debug('init hook config:', config.accessRights);

/**
 * @param  { Page } page without obfuscation
 * @return { Page }      obfuscated iiif
 */
const obfuscatePageMapper = (page) => {
  page.iiif = config.accessRights.unauthorizedIIIFUrl;
  page.iiifThumbnail = config.accessRights.unauthorizedIIIFImageUrl;
  page.obfuscated = true;
  return page;
};

/**
 * Gibven an issue instance, obfuscate iiif for any page
 * @param  {[type]} issue [description]
 * @return {[type]}       [description]
 */
const obfuscateIssueMapper = (issue) => {
  issue.pages = issue.pages.map(obfuscatePageMapper);
  issue.obfuscated = true;
  return issue;
};

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
  if (config.accessRights.enable) {
    if (article.issue.accessRights === ACCESS_RIGHTS_CLOSED) {
      article.issue.obfuscated = true;
      article.obfuscated = true;
      article.content = '... *** ...';
      article.regions = article.regions.map(d => ({
        ...d,
        g: [],
        obfuscated: true,
        iiifFragment: config.accessRights.unauthorizedIIIFImageUrl,
      }));
      article.pages = article.pages.map(d => ({
        ...d,
        obfuscated: true,
        iiif: config.accessRights.unauthorizedIIIFUrl,
        iiifFragment: config.accessRights.unauthorizedIIIFImageUrl,
        iiifThumbnail: config.accessRights.unauthorizedIIIFImageUrl,
      }));
    }
  }
  return article;
};

const obfuscate = () => (context) => {
  const fullpath = `${context.path}.${context.method}`;
  const prefix = `[obfuscate (${fullpath})]`;

  if (context.params.authenticated) {
    debug(`${prefix} skipping obfuscation as the user ${context.params.user.uid} has the right credentials`);
  } else {
    switch (fullpath) {
      case 'issues.get':
        if (context.result.accessRights === ACCESS_RIGHTS_CLOSED) {
          debug(`${prefix} issue obfuscated due to context.result.accessRights: ${context.result.accessRights}`);
          context.result = obfuscateIssueMapper(context.result);
        }
        break;
      case 'articles.get':
        if (context.result.issue.accessRights === ACCESS_RIGHTS_CLOSED) {
          debug(`${prefix} issue obfuscated due to context.result.issue.accessRights: ${context.result.issue.accessRights}`);
          context.result = obfuscateArticleMapper(context.result);
        }
        break;
      case 'articles.find':
        debug(`${prefix} verify accessRights per article issue`);
        for (let i = 0, l = context.result.data.length; i < l; i += 1) {
          if (context.result.data[i].issue.accessRights === ACCESS_RIGHTS_CLOSED) {
            context.result.data[i] = obfuscateArticleMapper(context.result.data[i]);
          }
        }
        break;
      default:
        debug(`${prefix} WARNING no fullpath rule matching: '${fullpath}'`);
        throw new Error(`${prefix} cannot use 'obfuscate()' on this service.`);
    }
  }
};

module.exports = {
  obfuscate,
};
