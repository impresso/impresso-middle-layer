/**
 * Generates TypeScript types from JSON schemas hosted in the
 * https://github.com/impresso/impresso-schemas repository.
 *
 * Schemas are downloaded from a given branch into a temporary mirror that
 * preserves the repository directory layout, so relative `$ref`s between
 * schema files keep resolving. Every referenced schema is fetched
 * recursively, not only the ones explicitly listed.
 *
 * Usage: node src/scripts/generate-types-from-schemas-repo.js
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { compileFromFile } from 'json-schema-to-typescript'

const REPO = 'impresso/impresso-schemas'

const banner = `
/* eslint-disable */
/**
 * This file was automatically generated from the ${REPO} repository
 * by src/scripts/generate-types-from-schemas-repo.js.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run \`npm run generate-types-from-schemas-repo\` to regenerate this file.
 */
`

const rawUrl = (branch, filePath) =>
  `https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(branch)}/${filePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

/**
 * Base URL the schemas publish themselves under (GitHub Pages). It mirrors the
 * repository layout one to one, so a `$ref` to it is really a repo relative path.
 */
const PUBLISHED_BASE_URL = 'https://impresso.github.io/impresso-schemas/'

/**
 * Resolve a `$ref` target to a path relative to the root of the schemas repository.
 *
 * @param {string} target the `$ref` value with any `#...` fragment already stripped
 * @param {string} fromFilePath repo relative path of the schema containing the ref
 * @returns {string | undefined} repo relative path, or `undefined` when the ref is
 *   internal or points somewhere outside of the schemas repository
 */
const resolveRefTarget = (target, fromFilePath) => {
  if (target === '') return undefined
  if (target.startsWith(PUBLISHED_BASE_URL)) return target.slice(PUBLISHED_BASE_URL.length)
  if (/^[a-z]+:\/\//i.test(target)) return undefined
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromFilePath), target))
}

/**
 * Rewrite every `$ref` that points inside the schemas repository so that it becomes
 * relative to the referring file, and collect the referenced files. Rewriting keeps
 * the compiler resolving refs against the local mirror instead of going back to the
 * published (and possibly outdated) schemas site.
 *
 * @param {unknown} node
 * @param {string} fromFilePath repo relative path of the schema containing the refs
 * @param {Set<string>} refs collected repo relative paths, mutated in place
 * @returns {unknown} the rewritten node
 */
const rewriteRefs = (node, fromFilePath, refs) => {
  if (Array.isArray(node)) return node.map(item => rewriteRefs(item, fromFilePath, refs))
  if (node == null || typeof node !== 'object') return node

  return Object.fromEntries(
    Object.entries(node).flatMap(([key, value]) => {
      // The root `$id` is an absolute URL on the published site; keeping it would make
      // the resolver treat it as the base for every relative ref in this file.
      if (key === '$id' && typeof value === 'string' && value.startsWith(PUBLISHED_BASE_URL)) return []

      if (key === '$ref' && typeof value === 'string') {
        const [target, fragment] = value.split('#')
        const resolved = resolveRefTarget(target, fromFilePath)
        if (resolved == null) return [[key, value]]
        refs.add(resolved)
        const relative = path.posix.relative(path.posix.dirname(fromFilePath), resolved)
        const localRef = relative.startsWith('.') ? relative : `./${relative}`
        return [[key, fragment == null ? localRef : `${localRef}#${fragment}`]]
      }

      return [[key, rewriteRefs(value, fromFilePath, refs)]]
    })
  )
}

/**
 * Download `filePath` and everything it references (transitively) into `targetDir`,
 * keeping the repository directory layout.
 *
 * @param {string} branch
 * @param {string} filePath repo relative path
 * @param {string} targetDir
 * @param {Set<string>} downloaded paths already fetched, mutated in place
 */
async function downloadSchema(branch, filePath, targetDir, downloaded) {
  if (downloaded.has(filePath)) return
  downloaded.add(filePath)

  const url = rawUrl(branch, filePath)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`)
  }
  const content = await response.text()

  let schema
  try {
    schema = JSON.parse(content)
  } catch (e) {
    throw new Error(`Could not parse ${url} as JSON: ${e.message}`)
  }

  const refs = new Set()
  const rewritten = rewriteRefs(schema, filePath, refs)

  const localPath = path.join(targetDir, filePath)
  fs.mkdirSync(path.dirname(localPath), { recursive: true })
  fs.writeFileSync(localPath, JSON.stringify(rewritten, null, 2))

  for (const ref of refs) {
    await downloadSchema(branch, ref, targetDir, downloaded)
  }
}

/**
 * Split generated TypeScript into top level declaration blocks, each one keeping the
 * JSDoc comment that precedes it.
 *
 * @param {string} source
 * @returns {string[]}
 */
const splitDeclarations = source => {
  const blocks = []
  let current = []
  let depth = 0
  let inComment = false

  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (current.length === 0 && trimmed === '') continue
    current.push(line)

    if (inComment) {
      if (trimmed.endsWith('*/')) inComment = false
      continue
    }
    if (trimmed.startsWith('/*') && !trimmed.endsWith('*/')) {
      inComment = true
      continue
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue

    for (const char of line) {
      if (char === '{' || char === '(' || char === '[') depth += 1
      else if (char === '}' || char === ')' || char === ']') depth -= 1
    }

    if (depth <= 0 && (trimmed.endsWith(';') || trimmed.endsWith('}'))) {
      blocks.push(current.join('\n'))
      current = []
      depth = 0
    }
  }

  if (current.length > 0) blocks.push(current.join('\n'))
  return blocks
}

/**
 * Extract the name a declaration block introduces.
 *
 * @param {string} block
 * @returns {string | undefined}
 */
const declaredName = block => block.match(/export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/)?.[1]

/**
 * Merge the output of several schema compilations into one declaration list.
 *
 * Schemas listed together routinely compose the same parts, and every compilation
 * emits those parts again. Blocks that repeat verbatim are emitted once. Blocks that
 * reuse a name for a different type are renamed (with a numeric suffix) within the
 * compilation they came from, and every reference to them in that compilation is
 * updated, so the composed types keep pointing at the right definition.
 *
 * @param {string[]} tsContents compiled output, one entry per schema
 * @returns {string} the merged declarations
 */
const mergeDeclarations = tsContents => {
  /** @type {Map<string, string>} */
  const byName = new Map()
  const kept = []

  for (const content of tsContents) {
    let blocks = splitDeclarations(content)
    const names = new Set(blocks.map(declaredName).filter(name => name != null))

    for (const block of blocks) {
      const name = declaredName(block)
      const previous = name == null ? undefined : byName.get(name)
      if (name == null || previous == null || previous === block) continue

      let suffix = 1
      let renamed = `${name}${suffix}`
      while (byName.has(renamed) || names.has(renamed)) {
        suffix += 1
        renamed = `${name}${suffix}`
      }
      names.add(renamed)

      const pattern = new RegExp(`\\b${name}\\b`, 'g')
      blocks = blocks.map(item => item.replace(pattern, renamed))
      // eslint-disable-next-line no-console
      console.log(`  "${name}" is used for a different type by another schema, renamed to "${renamed}"`)
    }

    for (const block of blocks) {
      const name = declaredName(block)
      if (name != null && byName.get(name) === block) continue
      if (name != null) byName.set(name, block)
      kept.push(block)
    }
  }

  return kept.join('\n\n')
}

/**
 * Generate a single TypeScript declaration file out of a set of JSON schemas
 * taken from a branch of the impresso-schemas repository.
 *
 * @param {string} branch branch (or tag / commit ref) of the schemas repository
 * @param {string[]} files schema paths relative to the root of the schemas repository
 * @param {string} destinationFile path of the `.d.ts` file to write
 */
export async function generateTypes(branch, files, destinationFile) {
  // eslint-disable-next-line no-console
  console.log(`Generating ${destinationFile} from ${files.length} schema(s) of ${REPO}@${branch}...`)

  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impresso-schemas-'))
  try {
    const downloaded = new Set()
    for (const file of files) {
      await downloadSchema(branch, file, targetDir, downloaded)
    }

    const tsContents = []
    for (const file of files) {
      tsContents.push(
        await compileFromFile(path.join(targetDir, file), {
          bannerComment: '',
          cwd: path.dirname(path.join(targetDir, file)),
        })
      )
    }

    fs.mkdirSync(path.dirname(destinationFile), { recursive: true })
    fs.writeFileSync(destinationFile, [banner, mergeDeclarations(tsContents)].join('\n\n'))
    // eslint-disable-next-line no-console
    console.log(`  wrote ${destinationFile} (${downloaded.size} schema file(s) downloaded)`)
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true })
  }
}

async function generateAll() {
  const branch = '86-organize-json-schemas-by-data-phase'

  await generateTypes(
    branch,
    [
      'json/impresso-2/solr-indexing/content-item/content-item.part.access-rights.v1.schema.json',
      'json/impresso-2/solr-indexing/content-item/content-item.part.text.paper.v1.schema.json',
      'json/impresso-2/solr-indexing/content-item/content-item.part.text.transcript.v1.schema.json',
      'json/impresso-2/solr-indexing/content-item/content-item.part.text.semantic-enrichments.v1.schema.json',
      'json/impresso-2/solr-indexing/content-item/content-item.part.text.audio.v1.schema.json',
      'json/impresso-2/solr-indexing/content-item/content-item.part.contextual-metadata.v1.schema.json',
      'json/impresso-2/solr-indexing/content-item/content-item.part.core.v1.schema.json',
      'json/impresso-2/solr-indexing/content-item/content-item.root.image.v1.schema.json',
    ],
    './src/models/generated/impressoSchemas/solr/contentItem.d.ts'
  )

  await generateTypes(
    branch,
    [
      'json/impresso-2/solr-indexing/semantic-enrichments/sem.root.topics.v1.schema.json',
      'json/impresso-2/solr-indexing/semantic-enrichments/sem.part.tr-passages.v1.schema.json',
    ],
    './src/models/generated/impressoSchemas/solr/semanticEnrichment.d.ts'
  )
}

generateAll()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Done')
  })
  .catch(e => {
    console.error(e)
    process.exitCode = 1
  })
