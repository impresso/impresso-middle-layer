// Initializes the `filepond` service on path `/filepond`
const path = require('path');
const md5File = require('md5-file');
const createService = require('./filepond.class.js');
const hooks = require('./filepond.hooks');
const verbose = require('debug')('verbose:impresso/services:filepond');

module.exports = function (app) {
  const upload = app.get('multerClient');
  // Initialize our service with any options it requires
  app.use('/filepond',
    upload.single('filepond'),
    (req, res, next) => {
      if (req.method === 'POST') {
        req.feathers.checksum = md5File.sync(req.file.path);
        req.feathers.file = req.file;

        verbose('/filepond - uploaded file checksum:', req.feathers.checksum);

        app.get('redisClient')
          .get(`img:${req.feathers.checksum}`).then((image) => {
            if(image) {
              verbose('/filepond, found image with the checksum', req.feathers.checksum);
              res.send(req.feathers.checksum);
            } else {
              verbose('/filepond, we did not find any image with the checksum');
              next();
            }
          }).catch(next);

        // app.service('uploaded-images').find({
        //   query: {
        //     limit: 1,
        //   },
        //   where: {
        //     checksum: req.feathers.checksum,
        //   },
        // }).then((result) => {
        //   verbose('/filepond - file found with checksum:', result.total);
        //   if (result.total) {
        //     res.format({
        //       'text/plain': function () {
        //         res.end(String(result.data[0].checksum));
        //       },
        //     });
        //   } else {
        //     next();
        //   }
        // })
        // .catch(next); // exit with error
      }
    },
    createService(),
    (req, res) => {
      console.log('result', req.feathers.checksum);
      // Format the message as text/plain
      res.send(req.feathers.checksum);
    });
};
