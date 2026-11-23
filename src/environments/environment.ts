/**
 * Configuração de produção.
 *
 * `apiUrl` relativo: o front-end espera ser publicado no mesmo domínio da API
 * (ou atrás de um proxy reverso que encaminhe `/api`). A estratégia de publicação
 * e CORS ainda está pendente de decisão; ajuste aqui quando for definida.
 * Nunca coloque segredos neste arquivo: ele vai para o navegador.
 */
export const environment = {
  producao: true,
  apiUrl: '/api'
};
