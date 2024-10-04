import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [2, 3, 4, 5, 6]
    .map(target => ({ duration: '15s', target: target * 20 })),
};

const tokens = `
  Le 29 février 2020, le premier cas de covid-19 au Grand-Duché était officiellement annoncé par le ministère de la Santé. Mais selon les scientifiques du List, cette contamination est intervenue quelques jours après la présence effective du coronavirus dans le pays, puisque les premières traces détectées sont comprises dans un délai situé «entre le 12 et le 25 février», Henry-Michel Cauchie, responsable de l'étude Coronastep au sein du List, qui estime que le virus était présent «relativement tôt».
  Une affirmation basée sur l'analyse plus approfondie d'anciens échantillons d'eau usée, datant d'avril 2019. Si les recherches étaient centrées sur le norovirus, à l'origine de la grippe intestinale, les résultats ont démontré que le covid-19 avait atteint le Luxembourg bien avant le premier décès, recensé le 13 mars dernier. Jour où le pays enregistrait officiellement 26 cas.
  `.split(' ');

function getRandomToken() {
  const randomIndex = Math.floor(Math.random() * tokens.length);
  const token = tokens[randomIndex].replace(/[^A-zÀ-ÿ]/g, '');
  if (token.length > 0) return token;
  return getRandomToken();
}

export default function test() {

  const queryParameters = {
    language: 'fr',
    q: encodeURIComponent(getRandomToken()),
  };
  const qs = Object.entries(queryParameters).map(([k, v]) => `${k}=${v}`).join('&');

  const url = `http://localhost:3030/embeddings?${qs}`;
  // const url = `http://dev.impresso-project.ch/api/embeddings?${qs}`;

  // console.log(url);
  const res = http.get(url);
  check(res, { 'status was 200': r => r.status === 200 });
  sleep(1);
}
