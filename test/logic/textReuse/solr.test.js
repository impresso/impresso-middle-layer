const assert = require('assert');
const {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,

  DefaultClusterFields,
} = require('../../../src/logic/textReuse/solr');
const { validated } = require('../../../src/util/json');

const PassageSchemaUri =
  'https://github.com/impresso/impresso-middle-layer/tree/master/src/schema/models/text-reuse/passage.json';
const ClusterSchemaUri =
  'https://github.com/impresso/impresso-middle-layer/tree/master/src/schema/models/text-reuse/cluster.json';

const passagesSolrResponse = {
  responseHeader: {
    status: 0,
    QTime: 0,
    params: {
      q: 'ci_id_s:GDL-1938-05-13-a-i0042',
      hl: 'false',
      rows: '1',
    },
  },
  response: {
    numFound: 1,
    start: 0,
    docs: [
      {
        id: '-4959285765931909368',
        cluster_id_s: '25769809096',
        cluster_size_l: 20,
        beg_offset_i: 1683,
        end_offset_i: 1898,
        cc_b: true,
        ci_id_s: 'GDL-1938-05-13-a-i0042',
        page_nb_is: [4],
        nb_pages_i: 1,
        front_b: false,
        page_regions_plains: ['2600,1873,761,208'],
        meta_journal_s: 'GDL',
        meta_year_i: 1938,
        meta_month_i: 5,
        meta_yearmonth_s: '1938-05',
        meta_day_i: 13,
        meta_ed_s: 'a',
        meta_date_dt: '1938-05-13T00:00:00Z',
        meta_issue_id_s: 'GDL-1938-05-13-a',
        content_txt_fr:
          "Le taux d'escompte. — La\nBanque de Franco a abaissé son taux d'es-\ncompte de 3 à 2 A % La Banque de France\na abaissé, d'autre part, le taux des avances\nsur titres de 4 à 3 Y, % et celui des avances\nà 30 jours de 3 à",
        content_length_i: 215,
        title_txt_fr:
          'mEIIIEillEIIIEIIiailslllEIIIEIIIEIIIEIIIiEIIIEIIIEIII^II^. m ÉCONOMIE ET FINANCE •i ItMItEIIIEIIIEIIIEIIIEIIIEIIIEIIIElllEIIIEIIIEIBBEIIIEHIE m',
        _version_: 1656008109002326017,
      },
    ],
  },
};

const clustersSolrResponse = {
  responseHeader: {
    status: 0,
    QTime: 0,
    params: {
      q: 'id:*',
      rows: '1',
    },
  },
  response: {
    numFound: 458569,
    start: 0,
    docs: [
      {
        postproc_id_s: '90217',
        day_delta_i: 357,
        newspapers_ss: ['GDL', 'IMP'],
        passages_ss: [
          'IMP-1972-12-02-a-i0274@157:403',
          'GDL-1972-06-10-a-i0056@39:592',
          'GDL-1971-12-11-a-i0046@127:679',
        ],
        min_date_dt: '1971-12-11T00:00:00Z',
        max_date_dt: '1972-12-02T00:00:00Z',
        lex_overlap_d: 22.8571428571,
        cluster_size_l: 3,
        id: '163208759161',
        _version_: 1656447964590112778,
      },
    ],
  },
};

describe('getTextReusePassagesRequestForArticle', () => {
  it('returns expected response', () => {
    const expectedQueryParameters = {
      q: 'ci_id_s:abc123',
      hl: false,
      rows: 100,
    };
    const queryParameters = getTextReusePassagesRequestForArticle('abc123');
    assert.deepEqual(queryParameters, expectedQueryParameters);
  });
  it('raises an error when no ID is provided', () => {
    assert.throws(() => getTextReusePassagesRequestForArticle(null));
  });
});

describe('convertPassagesSolrResponseToPassages', () => {
  it('converts real response correctly', () => {
    const expectedPassages = [
      {
        id: '-4959285765931909368',
        clusterId: '25769809096',
        articleId: 'GDL-1938-05-13-a-i0042',
        offsetStart: 1683,
        offsetEnd: 1898,
        content: passagesSolrResponse.response.docs[0].content_txt_fr,
        title: passagesSolrResponse.response.docs[0].title_txt_fr,
        language: 'fr',
        journalId: 'GDL',
        date: '1938-05-13T00:00:00Z',
        pageNumbers: [4],
        pageRegions: [[2600, 1873, 761, 208]],
      },
    ];

    const passages = convertPassagesSolrResponseToPassages(passagesSolrResponse).map(p =>
      validated(p, PassageSchemaUri)
    );
    assert.deepEqual(passages, expectedPassages);
  });
});

describe('getTextReuseClustersRequestForIds', () => {
  it('returns expected response', () => {
    const queryParameters = getTextReuseClustersRequestForIds(['abc123', 'cde123']);
    const expectedQueryParameters = {
      q: 'id:abc123 OR id:cde123',
      rows: 2,
      hl: false,
      fl: DefaultClusterFields.join(','),
    };

    assert.deepEqual(queryParameters, expectedQueryParameters);
  });
});

describe('convertClustersSolrResponseToClusters', () => {
  const clusters = convertClustersSolrResponseToClusters(clustersSolrResponse).map(c => validated(c, ClusterSchemaUri));
  const expectedClusters = [
    {
      id: '163208759161',
      lexicalOverlap: 22.8571428571,
      clusterSize: 3,
      timeCoverage: {
        from: '1971-12-11',
        to: '1972-12-02',
      },
    },
  ];

  assert.deepStrictEqual(clusters, expectedClusters);
});
