/**
 * Configuração de produção.
 *
 * `FROTA_API_URL` é injetada pelo `npm run build:producao` (scripts/build-producao.mjs),
 * a partir da variável de ambiente de mesmo nome: URL https absoluta da API, já com `/api`.
 * Sem ela (ex.: `npm run build` puro, testes), vale `/api` relativo: o front-end precisa
 * ser servido no mesmo domínio da API ou atrás de um proxy reverso que encaminhe `/api`.
 * Nunca coloque segredos aqui: este valor vai para o navegador.
 */
declare const FROTA_API_URL: string | undefined;

export const environment = {
  producao: true,
  apiUrl: typeof FROTA_API_URL === 'string' ? FROTA_API_URL : '/api'
};
