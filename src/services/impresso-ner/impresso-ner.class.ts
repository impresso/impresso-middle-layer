import type { Params } from '@feathersjs/feathers'
import { logger } from '../../logger'
import { createFetchClient } from '../../utils/http/client'
import { IFetchClient } from '../../utils/http/client/base'

export interface RequestPayload {
  text: string
  method: 'ner' | 'ner-nel'
}

interface DownstreamRequestBody {
  data: string
}

// See
// https://github.com/impresso/impresso-annotation/blob/740a31e2c925e4a4d59be97710e390871754674d/frontend/impresso_annotation/templates/landing_page.html#L157
// https://github.com/impresso/newsagency-classification/blob/7031c3992edf0d4354d9a29dea769fe7320f455f/lib/bert_classification/HIPE-scorer/tagset.txt
// https://github.com/impresso/impresso-schemas/blob/31-revise-entity-json-schema/json/entities/entities.schema.json
type NerType =
  | 'comp.demonym'
  | 'comp.function'
  | 'comp.name'
  | 'comp.qualifier'
  | 'comp.title'
  | 'loc'
  | 'loc.add.elec'
  | 'loc.add.phys'
  | 'loc.adm.nat'
  | 'loc.adm.reg'
  | 'loc.adm.sup'
  | 'loc.adm.town'
  | 'loc.fac'
  | 'loc.oro'
  | 'loc.phys.astro'
  | 'loc.phys.geo'
  | 'loc.phys.hydro'
  | 'loc.unk'
  | 'org'
  | 'org.adm'
  | 'org.ent'
  | 'org.ent.pressagency'
  | 'org.ent.pressagency.AFP'
  | 'org.ent.pressagency.ANSA'
  | 'org.ent.pressagency.AP'
  | 'org.ent.pressagency.APA'
  | 'org.ent.pressagency.ATS-SDA'
  | 'org.ent.pressagency.Belga'
  | 'org.ent.pressagency.CTK'
  | 'org.ent.pressagency.DDP-DAPD'
  | 'org.ent.pressagency.DNB'
  | 'org.ent.pressagency.DPA'
  | 'org.ent.pressagency.Domei'
  | 'org.ent.pressagency.Europapress'
  | 'org.ent.pressagency.Extel'
  | 'org.ent.pressagency.Havas'
  | 'org.ent.pressagency.Kipa'
  | 'org.ent.pressagency.Reuters'
  | 'org.ent.pressagency.SPK-SMP'
  | 'org.ent.pressagency.Stefani'
  | 'org.ent.pressagency.TASS'
  | 'org.ent.pressagency.UP-UPI'
  | 'org.ent.pressagency.Wolff'
  | 'org.ent.pressagency.Xinhua'
  | 'org.ent.pressagency.ag'
  | 'org.ent.pressagency.unk'
  | 'pers'
  | 'pers.coll'
  | 'pers.ind'
  | 'pers.ind.articleauthor'
  | 'prod'
  | 'prod.doctr'
  | 'prod.media'
  | 'time'
  | 'time.date.abs'
  | 'time.hour.abs'
  | 'unk'
  | 'UNK'

/**
 * See https://github.com/impresso/impresso-schemas/blob/31-revise-entity-json-schema/json/entities/entities.schema.json
 */
interface DownstreamNes {
  // fields not in the schema
  index?: number // index
  id: string | string[]
  nested: boolean // is nested

  // fields from the schema

  // required:
  lOffset: number | null // left offset
  rOffset: number | null // right offset
  surface: string | null // surface form (text)
  type: NerType

  // optional:
  confidence_nel?: number // named entity linking confidence score
  confidence_ner?: number // named entity recognition confidence score

  wkd_id?: string // Wikidata ID
  wkpedia_pagename?: string // Wikipedia page name
  wkpedia_url?: string // Wikipedia URL

  function?: string // function
  name?: string // entity name

  title?: string
}

/**
 * Loosely based on https://github.com/impresso/impresso-schemas/blob/31-revise-entity-json-schema/json/entities/entities.schema.json
 * Some extra fields come from https://github.com/impresso/impresso-annotation/blob/main/backend/model_handler.py
 */
interface DownstreamResponse {
  sys_id: string // model id
  text?: string // input text
  ts: string // ISO timestamp
  nes: DownstreamNes[]
}

export interface ImpressoNerEntity {
  id: string
  type: NerType
  surfaceForm?: string
  offset?: { start: number; end: number }
  isTypeNested: boolean
  confidence: { ner?: number; nel?: number }
  wikidata?: {
    id: string
    wikipediaPageName?: string
    wikipediaPageUrl?: string
  }
  function?: string
  name?: string
}

export interface ImpressoNerResponse {
  modelId: string
  text: string
  timestamp: string
  entities: ImpressoNerEntity[]
}

export interface ImpressoNerServiceOptions {
  impressoNerServiceBaseUrl: string
}

const MethodToUrl = { ner: 'ner', 'ner-nel': 'ner-nel', nel: 'nel' }

export class ImpressoNerService {
  baseUrl: string
  private readonly client: IFetchClient

  constructor(options: ImpressoNerServiceOptions) {
    this.baseUrl = options.impressoNerServiceBaseUrl
    this.client = createFetchClient({})
  }

  async create(data: RequestPayload, params: Params) {
    const { text, method } = data

    const url = `${this.baseUrl}/${MethodToUrl[method]}/`

    const response = await this.client.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ data: text }),
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5 minutes
    })

    if (response.status !== 200) {
      let bodyText = ''
      try {
        bodyText = String(await response.text())
      } catch {
        /* ignore */
      }

      logger.error(`Failed to fetch downstream data. Error (${response.status}): ${bodyText}`)
      throw new Error('Failed to fetch downstream data')
    }

    try {
      const responseBody = await response.json()
      return convertDownstreamResponse(responseBody as DownstreamResponse, data)
    } catch (error) {
      logger.error('Failed to parse downstream response', error)
      throw new Error('Failed to parse downstream response')
    }
  }
}

const convertDownstreamResponse = (response: DownstreamResponse, request: RequestPayload): ImpressoNerResponse => ({
  modelId: response.sys_id,
  text: response.text != null ? response.text : request.text,
  timestamp: response.ts,
  entities: response.nes.map(convertDownstreamEntity),
})

const convertDownstreamEntity = (entity: DownstreamNes): ImpressoNerEntity => ({
  id: typeof entity.id === 'string' ? entity.id : entity.id?.join(',') ?? '',
  type: sanitizeType(entity.type) ?? 'unk',
  ...(entity.surface != null ? { surfaceForm: entity.surface } : {}),
  ...(entity.lOffset != null && entity.rOffset != null
    ? { offset: { start: entity.lOffset, end: entity.rOffset } }
    : {}),
  isTypeNested: entity.nested,
  confidence: { ner: entity.confidence_ner, nel: entity.confidence_nel },
  ...(entity.wkd_id != null && entity.wkd_id != 'NIL'
    ? {
        wikidata: {
          id: entity.wkd_id,
          wikipediaPageName: entity.wkpedia_pagename,
          wikipediaPageUrl: [null, undefined, 'N/A'].includes(entity.wkpedia_url) ? undefined : entity.wkpedia_url,
        },
      }
    : {}),
  ...(entity.function != null ? { function: entity.function } : {}),
  ...(entity.name != null ? { name: entity.name } : {}),
})

const sanitizeType = (type: NerType): NerType => {
  if (type === 'UNK') return 'unk'
  return type
}
