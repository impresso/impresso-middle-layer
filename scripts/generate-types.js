const { execSync } = require('node:child_process')
const fs = require('node:fs')

const basePath = './src/services'

// for now support only the followin services until we migrate everything:
const supportedServices = ['text-reuse-clusters']

const directories = fs
  .readdirSync('./src/services')
  .filter(item => {
    return fs.statSync(`${basePath}/${item}`).isDirectory()
  })
  .filter(item => supportedServices.includes(item))

directories.forEach(service => {
  // eslint-disable-next-line no-console
  console.log(`Generating types for service ${service}...`)
  const command =
    `quicktype --src-lang schema --src ${basePath}/${service}/schema/**/*.json` +
    ` --out ${basePath}/${service}/models/generated.ts --lang ts --just-types`
  execSync(command)
})
