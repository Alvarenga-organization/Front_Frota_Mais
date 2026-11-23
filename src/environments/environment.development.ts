/**
 * Configuração de desenvolvimento (`ng serve`).
 *
 * As chamadas vão para `/api` na mesma origem do `ng serve`; o proxy
 * (`proxy.conf.mjs`) encaminha para o back-end local, sem depender de CORS.
 */
export const environment = {
  producao: false,
  apiUrl: '/api'
};
