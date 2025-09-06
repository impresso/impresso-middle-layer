import assert from 'assert'
import { toHierarchy, sliceAtSplitpoints, annotate, render, toExcerpt, latinise, toTextWrap } from '../src/helpers'

const fulltext =
  "L'AFFAIRE DES BIJOUX DE LA BEGUM L'interrogatoire de Watson un des principaux complices II se prétend le filleul de M. Churchill / Marseille, 22 janvier. " +
  "La police, on le sait, a écroué un sixième personnage impliqué dans l'affaire du vol des bijoux de la Bégum : Lindsay Watson, arrêté à Strasbourg, commandant de cavalerie de réserve. Interrogé durant plusieurs heures dans les locaux de la police mobile à Marseille, il aurait reconnu qu'il se trouvait à Cannes le 3 août dernier, jour où fut commise l'agression. Il avait obtenu de la secrétaire de l'Aga Khan les détails sur le départ de ce dernier et de la Bégum, qui devaient prendre l'avion pour Deauville, tandis que cette secrétaire et le chauffeur devaient gagner par la route la station normande. Watson aurait également déclaré qu'il avait, avant l'agression, vu Paul Leca, à plusieurs reprises, à Marseille. Paul Leca, on le sait, est toujours recherché et certains estiment qu'il est le chef du gang. PROMENADE SUR LA CROISETTE On se rappelle également que Watson a été nettement mis en cause par Ruberti lors de son interrogatoire. Sur la Croisette, Paul Leca présenta Watson à " +
  "Ruberti en ces termes : « Voici l'homme dont je t'ai parlé pour l'affaire. > La veille de l'attaque, Ruberti rencontra encore, sur la célèbre promenade cannoise, Watson qui était en compagnie de la secrétaire de l'Aga Khan. Cette dernière, dont on ignore l'identité, avait été, à Paris, au service des beaux-parents de Watson. Elle aurait été entendue par les policiers qui, dès l'agression commise, avaient ouvert l'enquête et enregistré les déclarations du personnel attaché à la maison du prince. Enfin, Watson n'aurait pas caché aux policiers qu'il se livrait, à Cannes, à différents trafics sans d'ailleurs préciser lesquels. PAS UN MOT AU JUGE D'INSTRUCTION ! Transféré en fin de matinée au Parquet, Watson s'est refusé à toute déclaration au juge d'instruction hors la présence de son défenseur qui sera Me Paul Giaccobi, député de la Corse, ancien ministre qu'il aurait connu à Alger en 1944. Watson a été écroué à la prison des Baumettes sous l'inculpation de plicité de vol." +
  " Quant aux bijoux, nulle nouvelle. Les policiers n'en parlent pas davantage que de la suite de l'enquête, au sujet de laquelle ils sont absolument muets. Paris, 22 janvier. (A. FP.) — Les inspecteurs de la sûreté nationale qui enquêtent sur l'affaire des bijoux de la Bégum, ont arrêté samedi soir en Gare de Lyon deux individus qui descendaient du train de Marseille : Antoine Cardoliani et Carbone. D'autre part, dimanche matin, deux occupants d'une voiture qui avait été signalée par la police marseillaise comme appartenant à des membres du gang, ont été appréhendés à Paris. On ignore encore l'identité de ces derniers. UNE BELLE CARRIÈRE ! Georges Lindsay Watson, soupçonné d'avoir été l'instigateur du vol des bijoux de la Bégum, est né le 14 mars 1899 à Paris. Commandant de cavalerie de réserve, il serait officier de la Légion d'honneur et titulaire de la « Military Cross ». En outre, Watson a été en 1936 et 1938 chef du contentieux d'une compagnie d'assurances britannique à Paris." +
  " Watson, qui est d'ascendance écossaise, se présentait comme filleul de M. Churchill. H aurait été attaché comme capitaine à l'état-major du général Giraud, à Alger, puis aurait été chargé des relations avec les correspondants de presse étrangers durant les campagnes de Tunisie, d'Italie et de France. "
const lineBreaks = [
  33, 60, 88, 131, 154, 189, 222, 264, 301, 337, 371, 409, 447, 484, 520, 559, 596, 633, 672, 709, 749, 783, 823, 861,
  899, 930, 966, 993, 1022, 1062, 1098, 1135, 1170, 1208, 1245, 1286, 1323, 1362, 1399, 1442, 1476, 1519, 1552, 1587,
  1626, 1667, 1709, 1745, 1775, 1786, 1810, 1841, 1878, 1920, 1955, 1993, 2030, 2045, 2081, 2113, 2129, 2163, 2194,
  2237, 2275, 2282, 2301, 2334, 2369, 2407, 2442, 2477, 2506, 2529, 2564, 2602, 2638, 2673, 2711, 2753, 2774, 2808,
  2845, 2883, 2921, 2965, 3005, 3040, 3079, 3116, 3123, 3152, 3194, 3229, 3263, 3304, 3334, 3376, 3414,
]
const paragraphBreaks = [33, 60, 88, 154, 337, 993, 1810, 2045, 2129, 2282, 2301, 2529, 2774, 3123]
const regionBreaks = [131, 966, 1775, 2194, 2753]
// const regionBreaks = [39, 74, 964, 1932, 2355, 3524, 4438, 5028, 5658];

const fulltextBroken =
  "L'opinion et ^^ <^ le discours Wilson An Congrès américain * New-York, 9 janvier. " +
  "L'adresse de M. Wilson a produit une émotion profonde sur la Ghambre boudée de parlementaires, de diplomates" +
  ' et de fonctionnaires. Lorsque M. Willson déclara que la France doit obtenir réparation sur là question ' +
  "d'Alsace-Lorraine, toute l'assistance se leva, applaudissant et acclamant. Les membres de la mission serbe " +
  'ont particulièrement salué la déclaration concernant la restauration de îa Serbie et la liberté des peuples ' +
  'balkaniques. La décision de M. Wilson de prononcer ce discours a été tout à fait inattendue ; les conseillers ' +
  "les plus proches n'ont connu que mercredi l'existence de l'adresse. L'adresse de M. Wilson reçoit " +
  "l'approbation enthousiaste générale. M. Stone, président de la commission sénatoriale des " +
  "affaires étrangères, s'est déclaré pleinement d'accord avec M. Wilson. Les au tres sénateurs padent. " +
  "de l'adresse comme du plus grand document de l'Etat. M. Flood, président de la commission des affaires "

/*

./node_modules/.bin/eslint src/helpers.js \
--config .eslintrc.json --fix && mocha test/helpers.test.js

with debug
./node_modules/.bin/eslint src/helpers.js \
--config .eslintrc.json --fix && DEBUG=impresso* mocha test/helpers.test.js
*/

const lines = sliceAtSplitpoints(fulltext, lineBreaks)
const paragraphs = sliceAtSplitpoints(fulltext, paragraphBreaks)

describe('get excerpt of a text', () => {
  it('should perform an exact excerpt', () => {
    assert.deepEqual(
      toExcerpt(fulltextBroken, {
        TruncateLength: 20,
      }),
      "L'opinion et ^^ &lt;^ le discours Wilson An Congrès américain * New-York, 9 janvier. L'adresse de M. Wilson a produit..."
    )
  })
})

describe('should cut a text', () => {
  it('according to simple splitpoints', () => {
    assert.strictEqual(lines[16].t, 'Khan les détails sur le départ de ce ', 'verify corresponding segments in lines')
    // verify specific point
    assert.strictEqual(paragraphs[10].t, 'Paris, 22 janvier. ', 'verify corresponding segments')
    paragraphBreaks.forEach((p, i) => {
      assert.strictEqual(paragraphs[i].r, p)
    })
    assert.strictEqual(paragraphs.length, paragraphBreaks.length + 1, 'count splitpoints and generated chunks')
  })

  it('... respecting the initial offset', () => {
    // [ { t: 'La police, on le sait, a écroué ', r: 186, l: 154 },
    //   { t: 'un ', r: 189, l: 186 } ]
    const results = sliceAtSplitpoints(lines[5].t, [186], lines[5].l)

    assert.strictEqual(results.length, 2)
    assert.strictEqual(results[0].t, 'La police, on le sait, a écroué ')
    assert.strictEqual(results[0].l, lines[5].l)
    assert.strictEqual(results[0].r, 186)
    assert.strictEqual(results[1].t, 'un ')
    assert.strictEqual(results[1].l, 186)
    assert.strictEqual(results[1].r, lines[5].r)
  })
})

describe('should annotate a tokenized text', () => {
  it('with one annotation for one word in line 1', () => {
    annotate(lines, 'e019289', 53, 60)
    assert.strictEqual(lines[1].ref[0].uid, 'e019289')
  })

  it('with one annotation for line 5 and 6', () => {
    annotate(lines, 'e019283', 186, 207)
    // console.log(lines[5], lines[6], lines[7]);
    assert.strictEqual(lines[5].ref[0].uid, 'e019283')
    assert.strictEqual(lines[6].ref[0].uid, 'e019283')
    assert.strictEqual(!!lines[7].ref, false)
  })

  it('with multiple annotation for line 5 and 6', () => {
    annotate(lines, 'e019284', 186, 207) // exacty same as e019283
    annotate(lines, 'e019286', 189, 220) // goes to the following line
    annotate(lines, 'lindsay-watson', 264, 278)
    annotate(lines, 'aga-khan', 555, 563)

    assert.strictEqual(lines[5].ref[1].uid, 'e019284')
    assert.strictEqual(lines[5].ref.length, 2)
    // assert.strictEqual(lines[5].ref.map(d => d.uid).join(','), 'e019283,e019284,e019286');
    // console.log(,lines[7],lines[8])

    assert.strictEqual(lines[15].ref[0].uid, 'aga-khan')
    assert.strictEqual(lines[16].ref[0].uid, 'aga-khan')

    // assert.strictEqual(lines[6].ref[0].uid, 'e019283');
    assert.strictEqual(!!lines[7].ref, false)
  })

  it('render annotations on line 5 and 6, overlapping', () => {
    const md = render(lines)
    // console.log(md);
    assert.strictEqual(md[8], '<span ref="lindsay-watson">Lindsay Watson</span>, arrêté à Strasbourg, ')
    assert.strictEqual(md[15], 'avait obtenu de la secrétaire de l\'<span ref="aga-khan">Aga </span>')
    assert.strictEqual(
      render([lines[7], lines[8]])[1],
      '<span ref="lindsay-watson">Lindsay Watson</span>, arrêté à Strasbourg, ',
      'the same'
    )
  })
  //

  it('check grouping by regions', () => {
    const results = toHierarchy(lines, regionBreaks)
    const lastLineFirstRegion = results[0].g[results[0].g.length - 1]
    const firstLineSecondRegion = results[1].g[0]

    assert.strictEqual(lastLineFirstRegion.t, 'II se prétend le filleul de M. Churchill / ')
    assert.strictEqual(firstLineSecondRegion.t, 'Marseille, 22 janvier. ')
  })
})

describe('should work with empty splitpints', () => {
  const empties = sliceAtSplitpoints(fulltext, [])
  it('check with empty lines and empty regions', () => {
    assert.strictEqual(empties[0].t, fulltext)
  })
  it('check with empty regions and usual lines', () => {
    const results = toHierarchy(lines, [])
    assert.strictEqual(results[0].g[0].t, lines[0].t)
  })
  it('check grouping by empty regions', () => {
    const results = toHierarchy(empties, [])
    assert.strictEqual(results[0].g[0].t, fulltext)
  })
})
//
describe('should cut a text into pieces', () => {
  const ft =
    "APRÈS L'ACCIDENT DE LA SWISSAIR Le commandant de bord et son co-pilote ont été licenciés Au cours de sa séance du 28 juin, le Conseil d'administration de la Swissair a été informé de l'accident du 19 juin et en a discuté tous les aspects. Après entente avec l'Office fédéral de l'air, il communique : « Les enquêtes introduites par les autorités aéronautiques anglaise et suisse concernant l'amerrissage forcé d'un avion de la Swissair en vue de Folkeslone ne sont pas encore formellement terminées. Dès maintenant, cependant, il est établi que cet accident est dû uniquement à une grave défaillance humaine. L'avion en cause, venu à Genève de Londres où il devait retourner, était en parfait état de vol, mais le plein d'essence n'a pas été effectué avant le départ de Genève. Le commandant de bord et son co-pilote se sont rendus coupables d'une grave infraction aux instructions claires et précises contenues dans leur cahier des charges. Suspendus du service de vol " +
    "immédiatement après l'accident, ils viennent d'être licenciés sans délai par la Swissair. Le Conseil d'administration rend hommage à la mémoire des victimes de ce tragique accident et exprime ses profonds regrets. »--\"}. »--\""

  const lb = [
    16, 31, 53, 70, 88, 122, 156, 193, 229, 266, 300, 335, 371, 409, 445, 480, 511, 548, 581, 616, 648, 684, 719, 756,
    788, 824, 861, 897, 932, 965, 1001, 1040, 1076, 1109, 1141, 1174, 1187,
  ]

  const title = "APRÈS L'ACCIDENT DE LA SWISSAIR Le commandant de bord et son co-pilote ont été licenciés"

  const rb = [89, 549]

  it('annotate title in regions and verify printed results', () => {
    const ls = sliceAtSplitpoints(ft, lb)
    const results = toHierarchy(ls, rb)

    // console.log(ps);
    const lastLineFirstRegion = results[0].g[results[0].g.length - 1]
    const firstLineSecondRegion = results[1].g[0]

    // then annotate
    annotate(ls, 'title', 0, title.length, 'class')

    assert.strictEqual(lastLineFirstRegion.t, ' ont été licenciés')
    assert.strictEqual(firstLineSecondRegion.t, ' Au cours de sa séance du 28 juin,')
    // console.log(rs);
    const rendered = render(results)

    assert.strictEqual(rendered[0], '<span class="title">APRÈS L\'ACCIDENT</span>')
    assert.strictEqual(rendered[5], ' Au cours de sa séance du 28 juin,')
  })
})

describe('should latinise a text', () => {
  it('in french', () => {
    const ft = "APRÈS L'ACCIDENT"
    assert.strictEqual("APRES L'ACCIDENT", latinise(ft))
  })
})

describe('should cut a text around the annotation', () => {
  xit('cut around Navin', () => {
    const text =
      'Im Escher Tageblatt stand es geschlieben, daß der Nechtssozialist Arthur Nozier uuter den Auspizien des demokratischen Blattes einen Vortrag, m...'
    assert.strictEqual(
      ' Nechtssozialist Arthur <span ref="match">Nozier</span> uuter den Auspizien des',
      toTextWrap({
        text,
        l: 73,
        r: 79,
      })
    )
  })
})
