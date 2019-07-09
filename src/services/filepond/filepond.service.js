// Initializes the `filepond` service on path `/filepond`
const path = require('path');
const md5File = require('md5-file');
const createService = require('./filepond.class.js');
const hooks = require('./filepond.hooks');

module.exports = function (app) {
  const upload = app.get('multerClient');
  // Initialize our service with any options it requires
  app.use('/filepond',
    upload.single('filepond'),
    (req, res, next) => {
      if (req.method === 'POST') {
        req.feathers.checksum = md5File.sync(req.file.path);
        req.feathers.file = req.file;

        app.service('uploaded-images').find({
          query: {
            limit: 1,
          },
          where: {
            checksum: req.feathers.checksum,
          },
        }).then((result) => {
          if (result.total) {
            res.format({
              'text/plain': function () {
                res.end(String(result.data[0].uid));
              },
            });
          } else {
            next();
          }
        }, console.error).catch(console.error);
      }
    },
    createService(),
    (req, res) => {
      // Format the message as text/plain
      res.format({
        'text/plain': function () {
          res.end(String(req.file.filename));
        },
      });
    });
};
