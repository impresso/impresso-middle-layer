const async    = require('async');
const clc      = require('cli-color');

const _err     = clc.yellowBright.bold.bgRedBright,
      _ye      = clc.yellowBright;

const _help    = (err) => {
  console.log(_err('USAGE'),' TASK=<taskname> npm run cli');
  console.log('.. where <taskname> should be the module name in /src/admin/tasks ... \n')
  if(err)
    console.log(_err(err))
}

if(!process.env.TASK){
  _help()
  return
}

const tasks    = require(`./tasks/${process.env.TASK}`);
const app      = require('../app');

async.waterfall([
  // get the list of the contents folder matching globpath
  (next) => {
    console.log('\n---')
    next(null, app, {
      _err,
      _ye,
      _help
    });
  },
].concat(tasks), (err) => {
  if(err)
    console.log('errore maggiore', tasks)
  else
    console.log(`\n---\nthat's all folks!\n---`);
})
