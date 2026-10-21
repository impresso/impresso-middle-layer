import { strict as assert } from 'assert'
import { topicIndexDocToTopicStub } from '@/useCases/prepareTopics.js'

const baseDoc = {
  id: 'tmGDL_tp00_fr',
  lg_s: 'fr',
  tp_model_s: 'tmGDL',
  tp_nb_i: 0,
  word_probs_dpf: 'suisse|0.0163 course|0.01104 point|0.01065',
  topic_suggest: 'suisse course point',
  _version_: 1,
}

describe('useCases/prepareTopics topicIndexDocToTopicStub', () => {
  it('maps the base fields and words', () => {
    const stub = topicIndexDocToTopicStub(baseDoc)
    assert.equal(stub.id, 'tmGDL_tp00_fr')
    assert.equal(stub.language, 'fr')
    assert.equal(stub.model, 'tmGDL')
    assert.deepEqual(stub.words, [
      { w: 'suisse', p: 0.0163 },
      { w: 'course', p: 0.01104 },
      { w: 'point', p: 0.01065 },
    ])
  })

  it('carries every topic labels v3 field into the stub', () => {
    const stub = topicIndexDocToTopicStub({
      ...baseDoc,
      tp_desc_s: 'Sport et compétitions',
      tp_meta_s: 'sample metadata',
      topic_type_s: 'sports',
      label_short_s: 'Sport',
      label_long_txt_en: 'Sports results and competitions',
      confidence_s: 'high',
      representative_terms_ss: ['sport', 'course'],
      generated_by_s: 'OpenAI',
    })
    assert.equal(stub.topicNumber, 0)
    assert.equal(stub.description, 'Sport et compétitions')
    assert.equal(stub.metadata, 'sample metadata')
    assert.equal(stub.category, 'sports')
    assert.equal(stub.shortLabel, 'Sport')
    assert.equal(stub.longLabel, 'Sports results and competitions')
    assert.equal(stub.confidence, 'high')
    assert.deepEqual(stub.representativeTerms, ['sport', 'course'])
    assert.equal(stub.generatedBy, 'OpenAI')
  })

  it('does not store topic_suggest or _version_ and omits absent label fields', () => {
    const stub = topicIndexDocToTopicStub(baseDoc)
    const json = JSON.parse(JSON.stringify(stub))
    assert.equal('topic_suggest' in json, false)
    assert.equal('_version_' in json, false)
    assert.equal('shortLabel' in json, false)
    assert.equal('description' in json, false)
  })
})
