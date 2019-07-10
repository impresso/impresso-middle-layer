/* eslint-disable no-unused-vars */
const fs = require('fs');
const path = require('path');
const rp = require('request-promise');
const sharp = require('sharp');
const verbose = require('debug')('verbose:impresso/services:filepond');

class Service {
  constructor(options) {
    this.options = options || {};
  }

  setup(app) {
    this.app = app;
  }

  async create(data, params) {
    const file = path.join(this.app.get('multer').dest, params.file.filename);
    verbose('create:', file);
    const url = this.app.get('images').visualSignature.endpoint;
    verbose('visualSignature service url:', url);
    // Promise: process image
    const fingerprintPromise = this.processImage(file)
      .then(imageBuffer => rp({
        url,
        method: 'POST',
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
      }));
    // promise: create base64 representation of the given file
    const thumbnailPromise = sharp(file)
      .resize(200)
      .toBuffer()
      .then(d => d.toString('base64'));
    // send signature to mysql
    const image = await Promise.all([
      fingerprintPromise,
      thumbnailPromise,
    ]).then(([fingerprint, thumbnail]) => ({
      uid: params.file.filename,
      name: params.file.originalname,
      signature: fingerprint.vector_b64,
      checksum: params.checksum,
      thumbnail,
    }));

    verbose('image - uid:', image.uid, '- checksum', image.checksum);
    await this.app.get('redisClient')
      .set(`img:${image.checksum}`, JSON.stringify(image));
    
    return image;
  }

  processImage(file, maxWidth = 1000, maxHeight = 1000) {
    return sharp(file)
      .trim()
      .resize(maxWidth, maxHeight, {
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      })
      .toFormat('jpeg')
      .toBuffer()
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
