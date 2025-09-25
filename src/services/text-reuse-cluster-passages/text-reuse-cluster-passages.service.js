import { TextReuseClusterPassages } from './text-reuse-cluster-passages.class'
import hooks from './text-reuse-cluster-passages.hooks'

export default function (app) {
  app.use('/text-reuse-cluster-passages', new TextReuseClusterPassages({}, app))
  app.service('text-reuse-cluster-passages').hooks(hooks)
}
