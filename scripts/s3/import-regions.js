/**
 * Note: this won't work without the aws installed.
 * We do not ship it with the package.json since it is a standalone task
 * that probably need to be done only once.
 *
 * doc aws https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/welcome.html
 */
const {config, query} = require('../bulk');
const aws = require('aws-sdk');
const fs = require('fs');
const _ = require('lodash');
const {eachSeries} = require('async');
const debug = require('debug')('impresso/scripts/s3:import-regions');

const s3 = new aws.S3({
  endpoint: config.s3.host,
  accessKeyId: config.s3.accessKey,
  secretAccessKey: config.s3.secretKey
});
const BUCKET = 'original-canonical-data';
const LIMIT = 1000;

debug(`s3.listObjects of BUCKET : '${BUCKET}' using host: ${config.s3.host}.`);

fs.readFile('./.marker', (err, marker) => {
  console.log(marker)
  s3.listObjects({
    Bucket: BUCKET,
    MaxKeys: LIMIT,
    Marker: marker ? marker.toString(): undefined,
    Prefix: 'GDL/195'
  }, async (err, data) => {
    if (err) {
      console.log('err', err);
      throw 'error in getting s3 data';
    }
    debug(`s3.listObjects of BUCKET : '${BUCKET}' success! Marker: ${marker}, next marker: ${data.NextMarker}.`);

    // console.log('data', data.NextMarker, data);
    let i = 0;
    let l = data.Contents.length;
    let keyWithErrors = [];
    eachSeries(data.Contents,  (d, cb) => {
      // console.log('give me', d);
      i = i + 1;
      s3.getObject({
        Bucket: BUCKET,
        Key: d.Key
      }, async (err, res) => {
        if (err) {
          return cb(err);
        }
        let body;
        try{
           body = JSON.parse(res.Body.toString());
        } catch(e) {
          keyWithErrors.push(d.Key);
          // console.log(d.Key,'body:', res.Body.toString());
          return cb();
        }
        if (!body.r) {
          return cb();
        }

        const versionId = res.VersionId;
        const pageUid = d.Key.match(/\/([^.\/]+?)\.json$/)[1];

        debug(`s3.listObjects eachSeries.getObject version: '${versionId}', pageUid:'${pageUid}', ${i}/${l}`);

        const pagesToArticles = _(body.r).groupBy('pOf').map((sections, articleUid) => {
          // concatenate all regions in sections { c: [ 122, 1367, 953, 600 ],}
          const regions = sections.reduce((acc, value) => {
            return acc.concat(value.c)
          }, []);
          return {
            page_uid: pageUid,
            versionId: versionId,
            uid: articleUid,
            regions
          }
        }).value();
        debug(`s3.listObjects eachSeries.getObject saving REGIONS: ${pagesToArticles.length} ...`);

        const relationships = await query('articles', 'merge_regions', pagesToArticles, 100)
          .catch(err => {
            cb(err);
          });

        debug(`s3.listObjects eachSeries.getObject saving REGIONS n: ${pagesToArticles.length} done!`);

        cb();
      })
    }, (err) => {
      if(err)
        console.log('err', err);
      else {
        // write marker to disk
        if(!data.NextMarker) {
          //console.log(data)
          throw 'no next marker';
        }
        fs.writeFileSync('./.marker', data.NextMarker);
        if(keyWithErrors.length) {
          fs.appendFileSync('./.keyWithErrors', `${keyWithErrors.join('\n')}\n`);
        }
        console.log('all good, next marker:', data.NextMarker);
      }
      process.exit();
    })
    // for(const file of data.Contents) {
    //   const result = await s3get({
    //     Bucket: 'original-canonical-data',
    //     Key: file.Key
    //   });
    //
    //   console.log(result);
    // }
  });
});
