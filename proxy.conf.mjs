// Proxy do servidor de desenvolvimento (ng serve): encaminha /api para o back-end
// local, evitando CORS no navegador. Usado só em desenvolvimento (local ou Codespaces).
// Para apontar para outro endereço: FROTA_API_ALVO=http://host:porta npm start
const alvo = process.env.FROTA_API_ALVO || 'http://localhost:8080';

export default {
  '/api': {
    target: alvo,
    secure: true,
    // Necessário para alvos remotos (ex.: porta encaminhada do Codespaces), que
    // roteiam pelo cabeçalho Host; inofensivo para localhost.
    changeOrigin: true,
    logLevel: 'warn'
  }
};
