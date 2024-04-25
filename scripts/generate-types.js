const { execSync } = require('node:child_process')
const fs = require('node:fs')

const basePath = './src/schema'

const schemaBits = ['schemas', 'parameters', 'requestBodies', 'responses']

const directories = fs
  .readdirSync(basePath)
  .filter(item => {
    return fs.statSync(`${basePath}/${item}`).isDirectory()
  })
  .filter(item => schemaBits.includes(item))

directories.forEach(dir => {
  // eslint-disable-next-line no-console
  console.log(`Generating types for service ${dir}...`)
  const command =
    `quicktype --src-lang schema --src ${basePath}/${dir}/*.json` +
    ` --out ./src/models/generated/${dir}.ts --lang ts --just-types`
  execSync(command)
})
