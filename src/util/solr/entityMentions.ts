import type { SemanticEnrichmentsFields } from '@/models/consolidated/solr/index.js'
import type { ContentItemMention } from '@/models/generated/app/entities/contentItem.js'
import { parseDPFS } from './transformers.js'

const MentionTypes = ['pers', 'loc', 'org', 'pressagency', 'radiostation'] as const
type MentionType = (typeof MentionTypes)[number]

export const EntityMentionFields = MentionTypes.flatMap(
  type =>
    [
      `${type}_entity_ids_dpfs`,
      `${type}_mention_surfaces_json_plain`,
      `${type}_mention_offsets_json_plain`,
      `${type}_mention_ner_conf_dpfs`,
    ] satisfies (keyof SemanticEnrichmentsFields)[]
)

/** Decode stored occurrence arrays without requesting Solr's JSON transformer. */
export const parseMentionOffsets = (value?: string): [number, number][] => {
  if (value == null) return []
  const offsets: unknown = JSON.parse(value)
  if (!Array.isArray(offsets)) throw new TypeError('Mention offsets must be an array')
  return offsets.map((pair: unknown) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new TypeError('Mention offsets must contain [start, length] pairs')
    }
    const start: unknown = pair[0]
    const length: unknown = pair[1]
    if (typeof start !== 'number' || typeof length !== 'number') {
      throw new TypeError('Mention offsets must contain [start, length] pairs')
    }
    return [start, length]
  })
}

const parseSurfaces = (value?: string): string[] => {
  if (value == null) return []
  const surfaces: unknown = JSON.parse(value)
  if (!Array.isArray(surfaces) || !surfaces.every(v => typeof v === 'string')) {
    throw new TypeError('Mention surfaces must be an array of strings')
  }
  return surfaces
}

const getMentions = (doc: Partial<SemanticEnrichmentsFields>, type: MentionType): ContentItemMention[] => {
  const offsets = parseMentionOffsets(doc[`${type}_mention_offsets_json_plain`])
  const surfaces = parseSurfaces(doc[`${type}_mention_surfaces_json_plain`])
  const confidences = parseDPFS(
    ([surface, confidence]) => ({ surface, confidence: Number(confidence) }),
    [(doc[`${type}_mention_ner_conf_dpfs`] ?? []).join(' ')]
  )
  return surfaces.map((surfaceForm, index) => {
    const offset = offsets[index]
    return {
      surfaceForm,
      mentionConfidence: confidences[index]?.confidence,
      startOffset: offset?.[0],
      endOffset: offset == null ? undefined : offset[0] + offset[1],
    }
  })
}

export const getContentItemMentions = (doc: Partial<SemanticEnrichmentsFields>) => ({
  persons: getMentions(doc, 'pers'),
  locations: getMentions(doc, 'loc'),
  organisations: getMentions(doc, 'org'),
  newsagencies: getMentions(doc, 'pressagency'),
  radiostations: getMentions(doc, 'radiostation'),
})

/** Preserve the legacy article offset groups for readers still using Article. */
export const getArticleMentionOffsets = (doc: Partial<SemanticEnrichmentsFields>) =>
  MentionTypes.flatMap(type => {
    const offsets = parseMentionOffsets(doc[`${type}_mention_offsets_json_plain`])
    if (offsets.length === 0) return []
    let category: string = type
    if (type === 'pressagency') category = 'nag'
    return [{ [category]: offsets }]
  })
