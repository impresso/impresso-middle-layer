import assert from 'assert'
import Topic from '../../src/models/topics.model'
/*
./node_modules/.bin/eslint \
src/models test/models \
--config .eslintrc.json --fix &&
DEBUG=impresso* mocha test/models/topics.model.test.js
*/

const mock = {
  id: 'tmGDL_tp00_fr',
  lg_s: 'fr',
  tp_model_s: 'tmGDL',
  tp_nb_i: 0,
  word_probs_dpf:
    'suisse|0.0163 course|0.01104 point|0.01065 concours|0.00939 sport|0.00808 prix|0.00741 club|0.00718 premier|0.00657 dimanche|0.00655 genève|0.00655 lausanne|0.00629 résultat|0.00592 championnat|0.00587 épreuve|0.00571 sportif|0.00555 ski|0.00542 tir|0.00509 international|0.00502 kilomètre|0.00499 minute|0.00481 grand|0.00434 page|0.00428 battre|0.00427 mètre|0.00422 équipe|0.00416 sec|0.00413 champion|0.00375 catégorie|0.00369 zurich|0.00363 temps|0.00354 meilleur|0.00337 série|0.00331 lieu|0.00326 concurrent|0.00314 centimètre|0.0031 tour|0.00308 voici|0.00305 samedi|0.00295 parcours|0.00289 classement|0.00263 plus|0.00262 départ|0.00258 suivre|0.00255 mlle|0.00246 journée|0.00245 tireur|0.0024 dernier|0.00239 section|0.00236 record|0.00235 heure|0.00234 beau|0.00234 piste|0.00227 chevaux|0.00226 coureur|0.00217 neige|0.00213 saut|0.0021 romand|0.00201 coupe|0.00201 bat|0.00197 amateur|0.00195 match|0.00195 cavalier|0.00189 national|0.00184 france|0.00184 sports|0.0018 nombreux|0.0018 gymnastique|0.0018 année|0.00174 excellent|0.00173 lutte|0.00173 cheval|0.00171 manifestation|0.0017 tennis|0.00167 compétition|0.00162 victoire|0.00161 individuel|0.00161 dame|0.0016 olympique|0.00159 suivant|0.00157 challenge|0.00156 succès|0.00156 junior|0.00155 cap|0.00154 cible|0.00152 prendre|0.00151 skieur|0.00149 hiver|0.00149 berne|0.00149 matin|0.00147 mme|0.00147 montreux|0.00145 place|0.00144 stade|0.00143 jeune|0.00141 entraînement|0.00138 disputer|0.00138 athlétisme|0.00137 part|0.00137 société|0.00136 villars|0.00134 ',
  topic_suggest:
    'suisse course point concours sport prix club premier dimanche genève lausanne résultat championnat épreuve sportif ski tir international kilomètre minute grand page battre mètre équipe sec champion catégorie zurich temps meilleur série lieu concurrent centimètre tour voici samedi parcours classement plus départ suivre mlle journée tireur dernier section record heure beau piste chevaux coureur neige saut romand coupe bat amateur match cavalier national france sports nombreux gymnastique année excellent lutte cheval manifestation tennis compétition victoire individuel dame olympique suivant challenge succès junior cap cible prendre skieur hiver berne matin mme montreux place stade jeune entraînement disputer athlétisme part société villars ',
  _version_: 1619108742041698304,
}

describe("'Topic' model", () => {
  it('check that a mock solr data correctly from select', () => {
    const topic = Topic.solrFactory()(mock)
    assert.equal(topic.language, 'fr')
    assert.equal(topic.words.length, 101)
    assert.equal(topic instanceof Topic, true)
  })

  it('check model still works from suggestions mock solr ', () => {
    const topic = Topic.solrSuggestFactory()({
      term: 'français france paris général suivre algérie gaulle ministre algérien maroc premier dernier alger lyon faire président précéder gouvernement république parisien plus aller mort marseille chef nord sud national prendre pierre venir nouveau tunisie heure roi gauche afrique main vichy ancien passer strasbourg petit jouer juin marocain rené maréchal mitterrand çais tunisien hier <b>jac</b>ques affaire françois voyage bordeaux soir alsace jours pouvoir semaine tunis cœur atout mai coup juillet correspondant levée carreau trèfle européen pique maire départ jean problème ben elysée officiel afp georges mois retour laval carte presse part dame matin nice savoie alsacien étranger ouvrir pétain libération etat fin boh mah',
      weight: 0,
      payload: 'tmGDL_tp08_fr',
    })
    assert.equal(topic instanceof Topic, true)
    assert.equal(topic.uid, 'tmGDL_tp08_fr')
    assert.equal(topic.words.length, 102)
    assert.equal(topic.excerpt[4], '...')
    assert.equal(topic.excerpt[5].w, '<b>jac</b>ques')
  })
})
