const {
  getGitBranch,
  getGitRevision,
  getVersion,
  getFirstAndLastDocumentDates,
  getNewspaperIndex,
} = require('./logic');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/version', {
    async find () {
      const solrConfig = app.get('solr');
      const sequelizeConfig = app.get('sequelize');
      const solr = app.get('cachedSolr');
      const [firstDate, lastDate] = await getFirstAndLastDocumentDates(solr);

      return {
        solr: {
          endpoints: [
            'search', 'mentions', 'topics', 'images', 'entities',
          ].reduce((acc, d) => {
            acc[d] = solrConfig[d].alias;
            return acc;
          }, {}),
        },
        mysql: {
          endpoint: sequelizeConfig.alias,
        },
        version: app.get('authentication').jwtOptions.issuer,
        apiVersion: {
          branch: await getGitBranch(),
          revision: await getGitRevision(),
          version: await getVersion(),
        },
        documentsDateSpan: { firstDate, lastDate },
        newspapers: await getNewspaperIndex(),
        features: app.get('features') || {},
      };
    },
  });
};
