import type { Params } from '@feathersjs/feathers'
import axios, { AxiosResponse } from 'axios'

export interface RequestPayload {
  text: string
}

interface DownstreamRequestBody {
  data: string
}

// See
// https://github.com/impresso/impresso-annotation/blob/740a31e2c925e4a4d59be97710e390871754674d/frontend/impresso_annotation/templates/landing_page.html#L157
type NerType =
  | 'pers'
  | 'pers.ind'
  | 'pers.coll'
  | 'pers.ind.articleauthor'
  | 'org'
  | 'org.adm'
  | 'org.ent'
  | 'org.ent.pressagency'
  | 'prod'
  | 'prod.media'
  | 'prod.doctr'
  | 'time'
  | 'time.date.abs'
  | 'loc'
  | 'loc.adm.town'
  | 'loc.adm.reg'
  | 'loc.adm.nat'
  | 'loc.adm.sup'
  | 'loc.phys.geo'
  | 'loc.phys.hydro'
  | 'loc.phys.astro'
  | 'loc.oro'
  | 'loc.fac'
  | 'loc.add.phys'
  | 'loc.add.elec'
  | 'loc.unk'

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
  impressoNerServiceUrl: string
}

export class ImpressoNerService {
  url: string

  constructor(options: ImpressoNerServiceOptions) {
    this.url = options.impressoNerServiceUrl
  }

  async create(data: RequestPayload, params: Params) {
    const { text } = data
    const response = await axios.post<DownstreamResponse, AxiosResponse<DownstreamResponse>, DownstreamRequestBody>(
      this.url,
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
