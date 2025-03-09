import { ImpressoApplication } from '../../types'
import { DatalabSupportService } from './datalab-support.class'

export default function (app: ImpressoApplication): void {
  app.use('/datalab-support', new DatalabSupportService())
}
