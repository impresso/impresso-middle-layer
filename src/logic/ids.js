function toArticlePageDetails(articleId, pageNumber) {
  const parts = articleId.split('-');
  const issueId = parts.slice(0, parts.length - 1).join('-');
  const pageId = [issueId, `p${String(pageNumber).padStart(4, 0)}`].join('-');

  return {
    issueId,
    pageId,
    articleId,
  };
}

module.exports = {
  toArticlePageDetails,
};
