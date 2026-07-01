import fs from 'node:fs'

const inputPath = process.argv[2] ?? '../impresso-corpus-metadata/data/gdrive_metadata/ALL-ALIAS.jsonl'
const outputPath =
  process.argv[3] ?? './src/services/version/resources/media_alias_directory.json'

const lines = fs
  .readFileSync(inputPath, 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0)

const items = lines.map(line => JSON.parse(line))

fs.writeFileSync(outputPath, `${JSON.stringify(items, null, 2)}\n`)

// eslint-disable-next-line no-console
console.log(`Wrote ${items.length} items to ${outputPath}`)
