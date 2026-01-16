import { TextReuseClusterPassages } from '@/services/text-reuse-cluster-passages/text-reuse-cluster-passages.class.js'
import hooks from '@/services/text-reuse-cluster-passages/text-reuse-cluster-passages.hooks.js'

export default function (app) {
  app.use('/text-reuse-cluster-passages', new TextReuseClusterPassages({}, app))
  app.service('text-reuse-cluster-passages').hooks(hooks)
}
