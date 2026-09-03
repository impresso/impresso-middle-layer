import assert from 'assert'
import { SolrNamespaces } from '@/solr.js'
import type { Filter } from '@/models/index.js'

const MockFiltersHamburgerWithPermissions: Filter[] = [
  {
    context: 'include',
    op: 'OR',
    type: 'hasTextContents',
    precision: 'exact',
  },
  {
    context: 'include',
    op: 'OR',
    type: 'string',
    precision: 'exact',
    q: ['hamburger'],
  },
  {
    context: 'include',
    op: 'OR',
    type: 'permissionGetTranscript',
    precision: 'exact',
    q: ['6', '24'],
  },
  {
    context: 'include',
    op: 'OR',
    type: 'hasTextContents',
    precision: 'exact',
  },
]
const MockFiltersHamburgerWithPermissionsExpectedQuery =
  '(content_txt_fr:"hamburger" OR content_txt_de:"hamburger" OR content_txt_en:"hamburger" OR content_txt_it:"hamburger" OR content_txt_es:"hamburger" OR content_txt_nl:"hamburger" OR content_txt:"hamburger") AND (rights_bm_index_get_tr_is:6 OR rights_bm_index_get_tr_is:24)'

const MockFiltersHamburgerWithTopics: Filter[] = [
  {
    context: 'include',
    op: 'OR',
    type: 'hasTextContents',
    precision: 'exact',
  },
  {
    context: 'include',
    op: 'OR',
    type: 'string',
    precision: 'exact',
    q: ['hamburger'],
  },
  {
    context: 'include',
    op: 'AND',
    type: 'topic',
    precision: 'exact',
    q: ['tm-de-all-v2.0_tp83_de', 'tm-de-all-v2.0_tp24_de', 'tm-de-all-v2.0_tp93_de'],
  },
  {
    context: 'include',
    op: 'OR',
    type: 'hasTextContents',
    precision: 'exact',
  },
]

const MockFiltersHamburgerWithTopicsExpectedQuery =
  '(content_txt_fr:"hamburger" OR content_txt_de:"hamburger" OR content_txt_en:"hamburger" OR content_txt_it:"hamburger" OR content_txt_es:"hamburger" OR content_txt_nl:"hamburger" OR content_txt:"hamburger") AND (topics_dpfs:tm-de-all-v2.0_tp83_de AND topics_dpfs:tm-de-all-v2.0_tp24_de AND topics_dpfs:tm-de-all-v2.0_tp93_de)'

const MockFiltersHamburgerWithTopicsDefaultOperatorsAndContext = [
  {
    type: 'hasTextContents',
    precision: 'exact',
  },
  {
    type: 'string',
    precision: 'exact',
    q: ['hamburger'],
  },
  {
    type: 'topic',
    precision: 'exact',
    q: ['tm-de-all-v2.0_tp83_de', 'tm-de-all-v2.0_tp24_de', 'tm-de-all-v2.0_tp93_de'],
  },
  {
    type: 'hasTextContents',
    precision: 'exact',
  },
] satisfies Filter[]

const MockFiltersHamburgerWithTopicsDefaultOperatorsAndContextExpectedQuery =
  '(content_txt_fr:"hamburger" OR content_txt_de:"hamburger" OR content_txt_en:"hamburger" OR content_txt_it:"hamburger" OR content_txt_es:"hamburger" OR content_txt_nl:"hamburger" OR content_txt:"hamburger") AND (topics_dpfs:tm-de-all-v2.0_tp83_de OR topics_dpfs:tm-de-all-v2.0_tp24_de OR topics_dpfs:tm-de-all-v2.0_tp93_de)'
