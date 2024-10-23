import type { Params } from '@feathersjs/feathers'
import axios, { AxiosResponse } from 'axios'

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

interface DownstreamNes {
  confidence_nel?: number // named entity linking confidence score
  confidence_ner: number // named entity recognition confidence score
  id: string
  lOffset: number // left offset
  nested: boolean // is nested
  rOffset: number // right offset
  surface: string // surface form (text)
  type: NerType

  wkd_id?: string // Wikidata ID
  wkpedia_pagename?: string // Wikipedia page name

  function?: string // function
  name?: string // entity name
}

interface DownstreamResponse {
  sys_id: string // model id
  text: string // input text
  ts: string // ISO timestamp
  nes: DownstreamNes[]
}

export interface ImpressoNerEntity {
  id: string
  type: NerType
  surfaceForm: string
  offset: { start: number; end: number }
  isTypeNested: boolean
  confidence: { ner: number; nel?: number }
  wikidata?: {
    id: string
    wikipediaPageName?: string
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

  constructor(options: ImpressoNerServiceOptions) {
    this.baseUrl = options.impressoNerServiceBaseUrl
  }

  async create(data: RequestPayload, params: Params) {
    const { text, method } = data

    const url = `${this.baseUrl}/${MethodToUrl[method]}/`

    const response = await axios.post<DownstreamResponse, AxiosResponse<DownstreamResponse>, DownstreamRequestBody>(
      url,
      { data: text }
    )
    if (response.status !== 200) {
      console.error(`Failed to fetch downstream data. Error (${response.status}): `, response.data)
      throw new Error('Failed to fetch downstream data')
    }
    return convertDownstreamResponse(response.data)
  }
}

const convertDownstreamResponse = (response: DownstreamResponse): ImpressoNerResponse => ({
  modelId: response.sys_id,
  text: response.text,
  timestamp: response.ts,
  entities: response.nes.map(convertDownstreamEntity),
})

const convertDownstreamEntity = (entity: DownstreamNes): ImpressoNerEntity => ({
  id: entity.id,
  type: entity.type,
  surfaceForm: entity.surface,
  offset: { start: entity.lOffset, end: entity.rOffset },
  isTypeNested: entity.nested,
  confidence: { ner: entity.confidence_ner, nel: entity.confidence_nel },
  ...(entity.wkd_id != null && entity.wkd_id != 'NIL'
    ? {
        wikidata: { id: entity.wkd_id, wikipediaPageName: entity.wkpedia_pagename },
      }
    : {}),
  ...(entity.function != null ? { function: entity.function } : {}),
  ...(entity.name != null ? { name: entity.name } : {}),
})
