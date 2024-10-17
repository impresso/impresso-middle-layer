import { parse } from 'yaml'
import { readFileSync } from 'fs'

export const loadYamlFile = <T>(filePath: string): T => {
  const content = readFileSync(filePath, 'utf8')
  return parse(content) as T
}
