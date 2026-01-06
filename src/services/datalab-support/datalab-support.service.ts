import { ImpressoApplication } from '@/types.js'
import { DatalabSupportService } from '@/services/datalab-support/datalab-support.class.js'

export default function (app: ImpressoApplication): void {
  app.use('/datalab-support', new DatalabSupportService())
}
