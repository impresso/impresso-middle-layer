const assert = require('assert');
const {toHierarchy, sliceAtSplitpoints, annotate, renderRefs} = require('../src/helpers');

const fulltext = "L'AFFAIRE DES BIJOUX DE LA BEGUM L'interrogatoire de Watson un des principaux complices II se prétend le filleul de M. Churchill / Marseille, 22 janvier. "+
"La police, on le sait, a écroué un sixième personnage impliqué dans l'affaire du vol des bijoux de la Bégum : Lindsay Watson, arrêté à Strasbourg, commandant de cavalerie de réserve. Interrogé durant plusieurs heures dans les locaux de la police mobile à Marseille, il aurait reconnu qu'il se trouvait à Cannes le 3 août dernier, jour où fut commise l'agression. Il avait obtenu de la secrétaire de l'Aga Khan les détails sur le départ de ce dernier et de la Bégum, qui devaient prendre l'avion pour Deauville, tandis que cette secrétaire et le chauffeur devaient gagner par la route la station normande. Watson aurait également déclaré qu'il avait, avant l'agression, vu Paul Leca, à plusieurs reprises, à Marseille. Paul Leca, on le sait, est toujours recherché et certains estiment qu'il est le chef du gang. PROMENADE SUR LA CROISETTE On se rappelle également que Watson a été nettement mis en cause par Ruberti lors de son interrogatoire. Sur la Croisette, Paul Leca présenta Watson à "+
"Ruberti en ces termes : « Voici l'homme dont je t'ai parlé pour l'affaire. > La veille de l'attaque, Ruberti rencontra encore, sur la célèbre promenade cannoise, Watson qui était en compagnie de la secrétaire de l'Aga Khan. Cette dernière, dont on ignore l'identité, avait été, à Paris, au service des beaux-parents de Watson. Elle aurait été entendue par les policiers qui, dès l'agression commise, avaient ouvert l'enquête et enregistré les déclarations du personnel attaché à la maison du prince. Enfin, Watson n'aurait pas caché aux policiers qu'il se livrait, à Cannes, à différents trafics sans d'ailleurs préciser lesquels. PAS UN MOT AU JUGE D'INSTRUCTION ! Transféré en fin de matinée au Parquet, Watson s'est refusé à toute déclaration au juge d'instruction hors la présence de son défenseur qui sera Me Paul Giaccobi, député de la Corse, ancien ministre qu'il aurait connu à Alger en 1944. Watson a été écroué à la prison des Baumettes sous l'inculpation de plicité de vol."+
" Quant aux bijoux, nulle nouvelle. Les policiers n'en parlent pas davantage que de la suite de l'enquête, au sujet de laquelle ils sont absolument muets. Paris, 22 janvier. (A. FP.) — Les inspecteurs de la sûreté nationale qui enquêtent sur l'affaire des bijoux de la Bégum, ont arrêté samedi soir en Gare de Lyon deux individus qui descendaient du train de Marseille : Antoine Cardoliani et Carbone. D'autre part, dimanche matin, deux occupants d'une voiture qui avait été signalée par la police marseillaise comme appartenant à des membres du gang, ont été appréhendés à Paris. On ignore encore l'identité de ces derniers. UNE BELLE CARRIÈRE ! Georges Lindsay Watson, soupçonné d'avoir été l'instigateur du vol des bijoux de la Bégum, est né le 14 mars 1899 à Paris. Commandant de cavalerie de réserve, il serait officier de la Légion d'honneur et titulaire de la « Military Cross ». En outre, Watson a été en 1936 et 1938 chef du contentieux d'une compagnie d'assurances britannique à Paris."+
" Watson, qui est d'ascendance écossaise, se présentait comme filleul de M. Churchill. H aurait été attaché comme capitaine à l'état-major du général Giraud, à Alger, puis aurait été chargé des relations avec les correspondants de presse étrangers durant les campagnes de Tunisie, d'Italie et de France. ";
const lineBreaks = [33, 60, 88, 131, 154, 189, 222, 264, 301, 337, 371, 409, 447, 484, 520, 559, 596, 633, 672, 709, 749, 783, 823, 861, 899, 930, 966, 993, 1022, 1062, 1098, 1135, 1170, 1208, 1245, 1286, 1323, 1362, 1399, 1442, 1476, 1519, 1552, 1587, 1626, 1667, 1709, 1745, 1775, 1786, 1810, 1841, 1878, 1920, 1955, 1993, 2030, 2045, 2081, 2113, 2129, 2163, 2194, 2237, 2275, 2282, 2301, 2334, 2369, 2407, 2442, 2477, 2506, 2529, 2564, 2602, 2638, 2673, 2711, 2753, 2774, 2808, 2845, 2883, 2921, 2965, 3005, 3040, 3079, 3116, 3123, 3152, 3194, 3229, 3263, 3304, 3334, 3376, 3414];
const paragraphBreaks = [33, 60, 88, 154, 337, 993, 1810, 2045, 2129, 2282, 2301, 2529, 2774, 3123];
const regionBreaks = [131, 966, 1775, 2194, 2753];
const pageBreaks = [967];
/*

./node_modules/.bin/eslint \
test/helpers.test.js src/helpers.js --fix &&
mocha test/helpers.test.js

with debug
./node_modules/.bin/eslint src/helpers.js --fix && DEBUG=impresso* mocha test/helpers.test.js
*/

const lines = sliceAtSplitpoints(fulltext, lineBreaks);
const splitted = sliceAtSplitpoints(fulltext, paragraphBreaks);

describe('should cut a text', () => {

  it('according to simple splitpoints', () => {
    assert.equal(lines[16].t, 'Khan les détails sur le départ de ce ', 'verify corresponding segments in lines')
    // verify specific point
    assert.equal(splitted[10].t, 'Paris, 22 janvier. ', 'verify corresponding segments');
    paragraphBreaks.forEach((p,i) => {
      assert.equal(splitted[i].r, p);
    })
    assert.equal(splitted.length, paragraphBreaks.length + 1, 'count splitpoints and generated chunks');
  });

  it('... respecting the initial offset', () => {
    // [ { t: 'La police, on le sait, a écroué ', r: 186, l: 154 },
    //   { t: 'un ', r: 189, l: 186 } ]
    const results = sliceAtSplitpoints(lines[5].t, [186], lines[5].l);

    assert.equal(results.length, 2);
    assert.equal(results[0].t, 'La police, on le sait, a écroué ');
    assert.equal(results[0].l, lines[5].l);
    assert.equal(results[0].r, 186);
    assert.equal(results[1].t, 'un ');
    assert.equal(results[1].l, 186);
    assert.equal(results[1].r, lines[5].r);
  });
});

describe('should annotate a tokenized text', () => {
  it('with one annotation for one word in line 1', () => {
    annotate(lines, 'e019289', 53, 60);
    assert.equal(lines[1].ref[0].uid, 'e019289');
  });

  it ('with one annotation for line 5 and 6', () => {
    annotate(lines, 'e019283', 186, 207);
    // console.log(lines[5], lines[6], lines[7]);
    assert.equal(lines[5].ref[0].uid, 'e019283');
    assert.equal(lines[6].ref[0].uid, 'e019283');
    assert.equal(!!lines[7].ref, false);
  })

  it ('with multiple annotation for line 5 and 6', () => {
    annotate(lines, 'e019284', 186, 207); // exacty same as e019283
    annotate(lines, 'e019286', 189, 220); // goes to the following line
    annotate(lines, 'lindsay-watson', 264,278);
    annotate(lines, 'aga-khan', 555,563);

    assert.equal(lines[5].ref[1].uid, 'e019284');
    assert.equal(lines[5].ref.length, 2),
    // assert.equal(lines[5].ref.map(d => d.uid).join(','), 'e019283,e019284,e019286');
    // console.log(,lines[7],lines[8])

    assert.equal(lines[15].ref[0].uid, 'aga-khan');
    assert.equal(lines[16].ref[0].uid, 'aga-khan');

    // assert.equal(lines[6].ref[0].uid, 'e019283');
    assert.equal(!!lines[7].ref, false);
  });

  it ('renderRefs annotations on line 5 and 6, overlapping', () => {
    const md = renderRefs(lines);
    console.log(md);
    assert.equal(md[8],'<span ref="lindsay-watson">Lindsay Watson</span>, arrêté à Strasbourg, ');

    assert.equal(renderRefs([lines[7], lines[8]])[1],'<span ref="lindsay-watson">Lindsay Watson</span>, arrêté à Strasbourg, ', 'the same');


  });
  //

  // it('with one hierarchical level', () => {
  //   const results = toHierarchy(splitted, regionBreaks);
  //   assert.equal(results[1].g[0].t, splitted[3].t, 'get corret paragraph at the beginning of a region');
  //   assert.ok(results);
  // });
  // it('with two hierarchical levels', () => {
  //   const results = toHierarchy(splitted, regionBreaks, pageBreaks);
  //   console.log(results[0])
  //   console.log(results[1])
  //   assert.ok(results[0]);
  // });
});
//
// describe('should cut a text into pieces (toHierarchy)', () => {
//
// });
