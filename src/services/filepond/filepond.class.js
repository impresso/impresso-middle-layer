/* eslint-disable no-unused-vars */
const fs = require('fs');
const path = require('path');
const rp = require('request-promise');
const sharp = require('sharp');

class Service {
  constructor (options) {
    this.options = options || {};
  }

  setup(app) {
    this.app = app;
  }

  create (data, params) {
    return new Promise((resolve, reject) => {
      const file = path.join(this.app.get('multer').dest, params.file.filename);

      const fingerprint = this.processImage(file).then((imageBuffer) => {
        return rp({
          method: 'POST',
          uri: 'https://impresso-images.dhlab.epfl.ch/visual-signature/',
          json: true,
          formData: {
            model_id: 'InceptionResNetV2',
            image: {
              value: imageBuffer,
              options: {
                filename: params.file.filename,
                contentType: 'image/jpeg',
              },
            },
          },
        });
      });

      const thumbnail = sharp(file)
        .resize(200)
        .toBuffer();

      Promise.all([fingerprint, thumbnail]).then((values) => {
        const image = {
          uid: params.file.filename,
          name: params.file.originalname,
          signature: values[0].vector_b64,
          checksum: params.checksum,
          thumbnail: values[1].toString('base64'),
        }

        this.app.get('redisClient').hmset(params.file.filename, image).then(resolve).catch(reject);
      });
    });
  }

  processImage(file, maxWidth = 1000, maxHeight = 1000) {
    return sharp(file)
      .trim()
      .resize(maxWidth, maxHeight, {
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      })
      .toFormat('jpeg')
      .toBuffer();
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
