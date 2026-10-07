import { strict as assert } from 'assert'
import { getContentItemMentions, getArticleMentionOffsets, parseMentionOffsets } from '@/util/solr/entityMentions.js'
import { toContentItem, type SlimDocumentFields } from '@/models/content-item.js'
import { FindMethodFields } from '@/services/content-items/content-items.class.js'

describe('content-item entity mention fields', () => {
  it('preserves repeated surfaces, confidence order and start/length offsets', () => {
    const result = getContentItemMentions({
      loc_mention_surfaces_json_plain: '["Pékin","Pékin","Pékin"]',
      loc_mention_offsets_json_plain: '[[0,5],[10,5],[30,5]]',
      loc_mention_ner_conf_dpfs: ['Pékin|93.61 Pékin|97.6 Pékin|97.98'],
      loc_mention_qids_json_plain: '["Q956",null,"Q956"]',
    })
    assert.deepEqual(result.locations, [
      { surfaceForm: 'Pékin', mentionConfidence: 93.61, startOffset: 0, endOffset: 5 },
      { surfaceForm: 'Pékin', mentionConfidence: 97.6, startOffset: 10, endOffset: 15 },
      { surfaceForm: 'Pékin', mentionConfidence: 97.98, startOffset: 30, endOffset: 35 },
    ])
  })

  it('handles confidence payloads spread across multiple Solr values', () => {
    assert.deepEqual(
      getContentItemMentions({
        pers_mention_surfaces_json_plain: '["Jean Dupont","Marie"]',
        pers_mention_ner_conf_dpfs: ['Jean Dupont|0.8', 'Marie|0.9'],
      }).persons.map(mention => mention.mentionConfidence),
      [0.8, 0.9]
    )
  })

  it('uses separate legacy offset groups so every type can be annotated', () => {
    assert.deepEqual(
      getArticleMentionOffsets({
        pers_mention_offsets_json_plain: '[[0,4]]',
        pressagency_mention_offsets_json_plain: '[[9,3]]',
        radiostation_mention_offsets_json_plain: '[[15,5]]',
      }),
      [{ pers: [[0, 4]] }, { nag: [[9, 3]] }, { radiostation: [[15, 5]] }]
    )
    assert.deepEqual(getArticleMentionOffsets({}), [])
  })

  it('rejects malformed offset arrays', () => {
    assert.throws(() => parseMentionOffsets('[[0,"5"]]'), TypeError)
    assert.throws(() => parseMentionOffsets('{}'), TypeError)
  })

  it('maps QID entity payloads and radiostation mentions into the content-item API', () => {
    const doc = {
      id: 'test',
      meta_journal_s: 'test',
      meta_date_dt: '1900-01-01T00:00:00Z',
      meta_source_type_s: 'newspaper',
      meta_source_medium_s: 'print',
      ocrqa_f: null,
      pressagency_entity_ids_dpfs: ['Q404|2', 'Q405|1'],
      radiostation_entity_ids_dpfs: ['Q406|1'],
      radiostation_mention_surfaces_json_plain: '["Radio"]',
      radiostation_mention_offsets_json_plain: '[[5,5]]',
      radiostation_mention_ner_conf_dpfs: ['Radio|0.99'],
      item_type_s: 'chapter',
      page_nb_is: [1],
      page_id_ss: ['test-p1'],
      nb_pages_i: 1,
      cc_b: false,
      rc_plains: [],
      lg_s: 'en',
      content_length_i: 0,
      snippet_plain: '',
      content_txt_en: '',
      content_txt_fr: '',
      content_txt_de: '',
      content_txt_it: '',
      content_txt_es: '',
      content_txt_nl: '',
      rights_data_domain_s: 'pbl',
      rights_copyright_s: 'pbl',
      rights_bm_explore_l: 0,
      rights_bm_get_tr_l: 0,
      rights_bm_get_img_l: 0,
      title_txt_en: '',
      title_txt_fr: '',
      title_txt_de: '',
      title_txt_it: '',
      title_txt_es: '',
      title_txt_nl: '',
    } satisfies SlimDocumentFields
    const result = toContentItem(doc)
    assert.deepEqual(
      result.semanticEnrichments?.namedEntities?.newsagencies?.map(({ id, count }) => ({ id, count })),
      [
        { id: 'Q404', count: 2 },
        { id: 'Q405', count: 1 },
      ]
    )
    assert.equal(result.semanticEnrichments?.namedEntities?.radiostations?.[0].id, 'Q406')
    assert.deepEqual(result.semanticEnrichments?.mentions?.radiostations, [
      { surfaceForm: 'Radio', mentionConfidence: 0.99, startOffset: 5, endOffset: 10 },
    ])
    assert.equal(result.text?.itemType, 'chapter')
  })

  it('requests stored JSON occurrence fields and the new payload fields', () => {
    assert.ok(FindMethodFields.includes('radiostation_entity_ids_dpfs'))
    assert.ok(FindMethodFields.includes('loc_mention_surfaces_json_plain'))
    assert.ok(FindMethodFields.includes('loc_mention_offsets_json_plain'))
    assert.ok(
      FindMethodFields.every(field => !field.startsWith('nem_offset_plain') && !field.includes('_entities_dpfs'))
    )
  })
})
