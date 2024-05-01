const fs = require('node:fs')
const { compileFromFile } = require('json-schema-to-typescript')

const banner = `
/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */
`

const basePath = './src/schema'
const outputPath = './src/models/generated'
const schemaBits = ['schemas', 'parameters', 'requestBodies', 'responses']
const directories = fs
  .readdirSync(basePath)
  .filter(item => {
    return fs.statSync(`${basePath}/${item}`).isDirectory()
  })
  .filter(item => schemaBits.includes(item))

async function compileDirectory(basePath, dir, outputBasePath) {
  const dirPath = `${basePath}/${dir}`

  const files = fs.readdirSync(dirPath).filter(item => {
    const path = `${dirPath}/${item}`
    const isDir = fs.statSync(path).isDirectory()
    return !isDir
  })
  // eslint-disable-next-line no-console
  console.log(`${files.length} files in ${dir}:`)

  const tsContents = await Promise.all(
    files.map(fileName => {
      const inputFile = `${dirPath}/${fileName}`
      return compileFromFile(inputFile, {
        bannerComment: '',
      })
    })
  )

  const content = [banner, ...tsContents].join('\n\n')
  const outputFile = `${outputBasePath}/${dir}.d.ts`
  fs.writeFileSync(outputFile, content)
}

async function compileAll(basePath, outputPath, directories) {
  for (const dir of directories) {
    // eslint-disable-next-line no-console
    console.log(`Generating types for group ${dir}...`)
    await compileDirectory(basePath, dir, outputPath)
  }
}

compileAll(basePath, outputPath, directories)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Done')
  })
  .catch(e => console.error(e))