import { Application } from '@feathersjs/feathers'
import { HookContext, NextFunction } from '@feathersjs/hooks'
import { getLogger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'

export const PartnerInstitutionsDirectoryUrl =
  'https://raw.githubusercontent.com/impresso/impresso-corpus-metadata/refs/heads/master/data/access_rights_masterfiles/partner_institutions_directory.json'

export interface PartnerInstitutionDirectoryEntry {
  partner_institution_id: string
  partner_institution_names: { lang: string; name: string }[]
  partner_bitmap_index: number
}

export type PartnerInstitutionsDirectory = PartnerInstitutionDirectoryEntry[]

const logger = getLogger(['impresso', 'partner-institutions-directory'])

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isPartnerInstitutionDirectoryEntry = (value: unknown): value is PartnerInstitutionDirectoryEntry => {
  return (
    isRecord(value) &&
    typeof value.partner_institution_id === 'string' &&
    Array.isArray(value.partner_institution_names) &&
    value.partner_institution_names.every(
      name => isRecord(name) && typeof name.lang === 'string' && typeof name.name === 'string'
    ) &&
    typeof value.partner_bitmap_index === 'number'
  )
}

const parsePartnerInstitutionsDirectory = (value: unknown): PartnerInstitutionsDirectory => {
  if (!Array.isArray(value) || !value.every(isPartnerInstitutionDirectoryEntry)) {
    throw new Error('Unexpected partner institutions directory format')
  }
  return value
}

export const fetchPartnerInstitutionsDirectory = async (
  fetchImpl: typeof fetch = fetch
): Promise<PartnerInstitutionsDirectory> => {
  const response = await fetchImpl(PartnerInstitutionsDirectoryUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch partner institutions directory: HTTP ${response.status}`)
  }

  return parsePartnerInstitutionsDirectory(await response.json())
}

export const getPartnerInstitutionsDirectory = (app: ImpressoApplication): PartnerInstitutionsDirectory => {
  const directory = app.get('partnerInstitutionsDirectory') as PartnerInstitutionsDirectory | undefined

  if (directory == null) {
    throw new Error('Partner institutions directory has not been loaded')
  }

  return directory
}

export const init = async (context: HookContext<ImpressoApplication & Application>, next: NextFunction) => {
  const directory = await fetchPartnerInstitutionsDirectory()
  context.app.set('partnerInstitutionsDirectory', directory)
  logger.info(`Loaded partner institutions directory with ${directory.length} entries`)

  await next()
}
