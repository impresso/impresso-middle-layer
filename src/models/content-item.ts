/**
 * Solr Content Item Model
 */

import type {
  AccessRightFields,
  ContentItemCore,
  ContextualMetadataFields,
  ImageFields,
  SemanticEnrichmentsFields,
  AudioFields,
} from './generated/solr/contentItem'
import type { LanguageCode, TextContentFields } from './solr'

import type {
  ContentItem,
  ContentItemAudioTimestamp,
  ContentItemMention,
  ContentItemNamedEntity,
  ContentItemTopic,
} from './generated/schemas/contentItem'
import { bigIntToBase64Bytes, OpenPermissions } from '../util/bigint'
import { asList, asNumberArray, parseDPFS } from '../util/solr/transformers'
import { setDifference } from '../util/fn'
import { getNameFromUid } from '../utils/entity.utils'
import { IFragmentsAndHighlights } from './articles.model'
import { getContentItemMatches } from '../services/search/search.extractors'
import { parsePlainsField } from '../util/solr'

const ContentItemCoreFields = [
  'id',
  'meta_issue_id_s',
  'meta_source_type_s',
  'meta_date_dt',
  'meta_journal_s',
  'meta_source_medium_s',
] satisfies (keyof ContentItemCore)[]

const ContentItemContextualMetadataFields = [
  'meta_country_code_s',
  'meta_province_code_s',
  'meta_partnerid_s',
] satisfies (keyof ContextualMetadataFields)[]

const ContentItemAccessFields = [
  'rights_copyright_s',
  'rights_data_domain_s',
  'rights_bm_explore_l',
  'rights_bm_get_tr_l',
  'rights_bm_get_img_l',
] satisfies (keyof AccessRightFields)[]

interface IWildcardTextFields {
  'title_txt_*': string
  'content_txt_*': string
}

const WildcardTextFields = ['title_txt_*', 'content_txt_*'] satisfies (keyof IWildcardTextFields)[]

const ContentItemTextFields = [
  'lg_s',
  'title_txt',
  'content_txt',
  'content_length_i',
  'doc_type_s',
  'item_type_s',
  'lg_orig_s',
  'snippet_plain',
] satisfies (keyof TextContentFields)[]

const ContentItemImageFields = [
  'cc_b',
  'front_b',
  'lb_plain',
  'nb_pages_i',
  'pb_plain',
  'rb_plain',
  'rc_plains',
  'page_id_ss',
  'page_nb_is',
  'pp_plain',
] satisfies (keyof ImageFields)[]

const ContentSemanticEnrichmentsFields = [
  'ocrqa_f',
  'pers_entities_dpfs',
  'loc_entities_dpfs',
  'nag_entities_dpfs',
  'org_entities_dpfs',
  'topics_dpfs',
  'pers_mention_conf_dpfs',
  'loc_mention_conf_dpfs',
  'org_mention_conf_dpfs',
  'nag_mention_conf_dpfs',
  'nem_offset_plain',
  'nag_offset_plain',
] satisfies (keyof SemanticEnrichmentsFields)[]

const AudioContentFields = [
  'meta_duration_s',
  'meta_start_time_s',
  'nb_record_i',
  'record_id_ss',
  'record_nb_is',
  'rreb_plain',
] satisfies (keyof AudioFields)[]

export type AllDocumentFields = Pick<ContentItemCore, (typeof ContentItemCoreFields)[0]> &
  Pick<ContextualMetadataFields, (typeof ContentItemContextualMetadataFields)[0]> &
  Pick<AccessRightFields, (typeof ContentItemAccessFields)[0]> &
  Pick<TextContentFields, (typeof ContentItemTextFields)[0]> &
  Pick<TextContentFields, `title_txt_${LanguageCode}` | `content_txt_${LanguageCode}`> &
  Pick<ImageFields, (typeof ContentItemImageFields)[0]> &
  Pick<SemanticEnrichmentsFields, (typeof ContentSemanticEnrichmentsFields)[0]> &
  Pick<AudioFields, (typeof AudioContentFields)[0]>

export type FullContentOnlyFieldsType =
  | 'lb_plain'
  | 'pb_plain'
  | 'rb_plain'
  | 'pp_plain'
  | 'content_txt_*'
  | 'rreb_plain'

export type SlimDocumentFields = Omit<AllDocumentFields, FullContentOnlyFieldsType>

export type IFullContentItemFieldsNames = keyof (AllDocumentFields & IWildcardTextFields)

const FullContentOnlyFields = [
  'lb_plain',
  'pb_plain',
  'rb_plain',
  'pp_plain',
  'content_txt_*',
  'rreb_plain',
] satisfies FullContentOnlyFieldsType[]

type ISlimContentItemFieldsNames = Exclude<IFullContentItemFieldsNames, FullContentOnlyFieldsType>

export const FullContentItemFieldsNames = [
  ...ContentItemCoreFields,
  ...ContentItemContextualMetadataFields,
  ...ContentItemAccessFields,
  ...ContentItemTextFields,
  ...ContentItemImageFields,
  ...ContentSemanticEnrichmentsFields,
  ...AudioContentFields,
  ...WildcardTextFields,
] satisfies IFullContentItemFieldsNames[]

export const SlimContentItemFieldsNames = [
  ...setDifference(FullContentItemFieldsNames, FullContentOnlyFields),
] satisfies ISlimContentItemFieldsNames[]

type XYWH = [number, number, number, number] // x, y, width, height

interface PageRegionCoordintates {
  pid: string // page ID
  c: XYWH[] // coordinates of the regions on the page:
}

type MentionTag = 'pers' | 'loc' | 'org' | 'nag'

type MentionsOffsets = {
  [key in MentionTag]?: number[][]
}

interface AudioRecordTimecode {
  s: number // start character offset
  l: number // length of the record section in characters
  tc: [number, number] // start and length in seconds
}

interface AudioRecordTimecodes {
  id: string // record ID
  n?: number // record number
  s?: [number, number] // start and end timecodes
  t: AudioRecordTimecode[]
}

interface PageTokenCoordinates {
  c: XYWH
  s: number // start character offset
  l: number // length of the text section in characters
}

interface PageRegionsCoordinates {
  id: string // page ID
  n: number // page number
  r?: XYWH[] // region coordinates
  t?: PageTokenCoordinates[] // text coordinates
}

const parseAudioRecordTimecodes = (field?: string | AudioRecordTimecodes[]): AudioRecordTimecodes[] => {
  if (!field) return []
  if (typeof field === 'string') {
    return JSON.parse(field) as AudioRecordTimecodes[]
  }
  return field as AudioRecordTimecodes[]
}

const parseMentionsOffsets = (field?: MentionsOffsets[] | string[]): MentionsOffsets => {
  if (!field) return {}
  const offsets: MentionsOffsets[] = typeof field === 'string' ? JSON.parse(field) : field
  return offsets.reduce((acc, item) => {
    return { ...acc, item }
  }, {} as MentionsOffsets)
}

const parseContentItemEntityDPFS = (dpfs?: string[]): ContentItemNamedEntity[] => {
  return parseDPFS(
    ([id, count]) => ({
      id,
      count: parseInt(count, 10),
      label: getNameFromUid(id),
    }),
    dpfs
  )
}

const parseContentItemTopicDPFS = (dpfs?: string[]): Pick<ContentItemTopic, 'id' | 'relevance'>[] => {
  return parseDPFS(
    ([id, count]) => ({
      id,
      relevance: parseFloat(count),
    }),
    dpfs
  )
}

const parseContentItemMentionDPFS = (
  dpfs?: string[]
): Pick<ContentItemMention, 'surfaceForm' | 'mentionConfidence'>[] => {
  return parseDPFS(
    ([id, count]) => ({
      surfaceForm: id,
      mentionConfidence: parseFloat(count),
    }),
    dpfs
  )
}

const mentionWithOffset = (offsets?: number[][]) => {
  return (
    item: Partial<ContentItemMention>,
    index: number
  ): Partial<ContentItemMention> & Pick<ContentItemMention, 'startOffset' | 'endOffset'> => {
    return {
      ...item,
      startOffset: offsets?.[index]?.[0],
      endOffset: offsets?.[index]?.[1],
    }
  }
}

const fromAudioRecordTimecode = (tc: AudioRecordTimecode): ContentItemAudioTimestamp => ({
  textLocation: [tc.s, tc.l],
  timeCode: tc.tc,
})

export const toContentItem = (doc: AllDocumentFields): ContentItem => {
  const regionCoordinates = asList<PageRegionCoordintates>(parsePlainsField(doc, 'rc_plains'))
  const mentionsOffsets = parseMentionsOffsets(doc.nem_offset_plain)

  return {
    id: doc.id,
    issueId: doc.meta_issue_id_s,
    meta: {
      sourceType: doc.meta_source_type_s,
      date: doc.meta_date_dt,
      mediaId: doc.meta_journal_s,
      sourceMedium: doc.meta_source_medium_s,
      countryCode: doc.meta_country_code_s,
      provinceCode: doc.meta_province_code_s,
      partnerId: doc.meta_partnerid_s,
    },
    access: {
      copyright: doc.rights_copyright_s,
      dataDomain: doc.rights_data_domain_s,
      accessBitmaps: {
        explore: bigIntToBase64Bytes(BigInt(doc.rights_bm_explore_l ?? OpenPermissions)),
        getTranscript: bigIntToBase64Bytes(BigInt(doc.rights_bm_get_tr_l ?? OpenPermissions)),
        getImages: bigIntToBase64Bytes(BigInt(doc.rights_bm_get_img_l ?? OpenPermissions)),
      },
    },
    text: {
      title: doc[`title_txt_${doc.lg_s as LanguageCode}`] ?? doc['title_txt'],
      content: doc[`content_txt_${doc.lg_s as LanguageCode}`] ?? doc['content_txt'],
      contentLength: doc.content_length_i ?? 0,
      documentType: doc.doc_type_s,
      itemType: doc.item_type_s,
      langCode: doc.lg_s,
      originalLangCode: doc.lg_orig_s,
      snippet: doc.snippet_plain,
    },
    image: {
      isCoordinatesConverted: doc.cc_b,
      isFrontPage: doc.front_b,
      lineBreaks: asNumberArray(doc.lb_plain),
      pagesCount: doc.nb_pages_i,
      paragraphBreaks: asNumberArray(doc.pb_plain),
      regionBreaks: asNumberArray(doc.rb_plain),
      pages: doc.page_id_ss?.map((pageId: string, idx: number) => {
        return {
          id: pageId,
          number: doc.page_nb_is?.[idx],
          regionCoordinates: regionCoordinates?.find(p => p.pid === pageId)?.c ?? [],
        }
      }),
    },
    semanticEnrichments: {
      ocrQuality: doc.ocrqa_f,
      namedEntities: {
        persons: parseContentItemEntityDPFS(doc.pers_entities_dpfs),
        locations: parseContentItemEntityDPFS(doc.loc_entities_dpfs),
        newsagencies: parseContentItemEntityDPFS(doc.nag_entities_dpfs),
        organisations: parseContentItemEntityDPFS(doc.org_entities_dpfs),
      },
      mentions: {
        persons: parseContentItemMentionDPFS(doc.pers_mention_conf_dpfs).map(mentionWithOffset(mentionsOffsets.pers)),
        locations: parseContentItemMentionDPFS(doc.loc_mention_conf_dpfs).map(mentionWithOffset(mentionsOffsets.loc)),
        organisations: parseContentItemMentionDPFS(doc.org_mention_conf_dpfs).map(
          mentionWithOffset(mentionsOffsets.org)
        ),
        newsagencies: parseContentItemMentionDPFS(doc.nag_mention_conf_dpfs).map(
          mentionWithOffset(mentionsOffsets.nag)
        ),
      },
      topics: parseContentItemTopicDPFS(doc.topics_dpfs),
    },
    audio: {
      duration: doc.meta_duration_s,
      startTime: doc.meta_start_time_s,
      recordsCount: doc.nb_record_i,
      records: doc.record_id_ss?.map((recordId: string, idx: number) => {
        return {
          id: recordId,
          number: doc.record_nb_is?.[idx],
          timecode: parseAudioRecordTimecodes(doc.rreb_plain)
            .find(r => r.id === recordId)
            ?.t?.map(fromAudioRecordTimecode),
        }
      }),
    },
  }
}
