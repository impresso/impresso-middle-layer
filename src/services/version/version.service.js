const {
  getGitBranch,
  getGitRevision,
  getVersion,
} = require('./logic');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/version', {
    async find() {
      const solrConfig = app.get('solr');
      const sequelizeConfig = app.get('sequelize');
      return {
        solr: {
          dataVersion: solrConfig.dataVersion,
          endpoints: [
            'search', 'mentions', 'topics', 'images', 'entities',
          ].reduce((acc, d) => {
            acc[d] = solrConfig[d].alias;
            return acc;
          }, {}),
        },
        mysql: {
          endpoint: sequelizeConfig.alias,
          dataVersion: sequelizeConfig.dataVersion,
        },
        version: app.get('authentication').jwtOptions.issuer,
        apiVersion: {
          branch: await getGitBranch(),
          revision: await getGitRevision(),
          version: await getVersion(),
        },
      };
    },
  });
};
