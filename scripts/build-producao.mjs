// Build de produção do Frota+ com a URL pública da API.
//
// Uso: FROTA_API_URL=https://api.exemplo.com npm run build:producao
//
// - FROTA_API_URL é a ORIGEM https da API (esquema + host [+ porta]), sem caminho;
//   o prefixo /api é acrescentado aqui. Não é segredo, mas não fica no código:
//   vem da variável de ambiente (painel da hospedagem ou linha de comando).
// - Recusa endereços de desenvolvimento (localhost, IPs privados, Codespaces) e http.
// - Depois do build, confere que o bundle aponta para a API informada e que não
//   sobrou nenhum endereço de desenvolvimento.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const SAIDA = join('dist', 'modelo-projeto-integrador', 'browser');
const PROIBIDOS_NO_BUNDLE = ['localhost:', '127.0.0.1', '.app.github.dev', '.github.dev'];

function falhar(mensagem) {
  console.error(`\n[build:producao] ${mensagem}\n`);
  process.exit(1);
}

function hostDeDesenvolvimento(host) {
  return host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '[::1]'
    || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    || host.endsWith('.github.dev') || host.endsWith('.githubpreview.dev');
}

function validarOrigemApi(texto) {
  const valor = (texto ?? '').trim();
  if (!valor) {
    throw new Error('Defina FROTA_API_URL com a origem https da API (ex.: https://api.exemplo.com).');
  }
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`FROTA_API_URL não é uma URL válida: "${valor}".`);
  }
  if (url.protocol !== 'https:') throw new Error('FROTA_API_URL precisa usar https.');
  if (url.username || url.password) throw new Error('FROTA_API_URL não pode conter usuário ou senha.');
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new Error('Informe só a origem (https://host[:porta]), sem caminho: o /api é acrescentado pelo build.');
  }
  if (hostDeDesenvolvimento(url.hostname)) {
    throw new Error(`FROTA_API_URL aponta para um endereço de desenvolvimento (${url.hostname}); use a URL pública da API.`);
  }
  // A API não é servida pela Vercel: apontar para lá repetiria o 404 de /api no próprio domínio do front-end.
  if (url.hostname === 'vercel.app' || url.hostname.endsWith('.vercel.app')) {
    throw new Error(`FROTA_API_URL aponta para a Vercel (${url.hostname}), onde só está o front-end; use a URL da API.`);
  }
  return `${url.origin}/api`;
}

function arquivosDoBundle(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap(item => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return arquivosDoBundle(caminho);
    return /\.(js|html|css)$/.test(item.name) ? [caminho] : [];
  });
}

function conferirBundle(apiUrl) {
  const arquivos = arquivosDoBundle(SAIDA);
  let encontrouApi = false;
  for (const arquivo of arquivos) {
    const conteudo = readFileSync(arquivo, 'utf8');
    if (conteudo.includes(apiUrl)) encontrouApi = true;
    const proibido = PROIBIDOS_NO_BUNDLE.find(trecho => conteudo.includes(trecho));
    if (proibido) falhar(`O bundle contém "${proibido}" em ${arquivo}. Corrija antes de publicar.`);
  }
  if (!encontrouApi) falhar(`A URL da API (${apiUrl}) não foi encontrada no bundle.`);
}

function principal() {
  let apiUrl;
  try {
    apiUrl = validarOrigemApi(process.env.FROTA_API_URL);
  } catch (erro) {
    falhar(erro.message);
  }
  console.log(`[build:producao] API: ${apiUrl}`);

  const ng = createRequire(import.meta.url).resolve('@angular/cli/bin/ng.js');
  const build = spawnSync(
    process.execPath,
    [ng, 'build', '--configuration', 'production', '--define', `FROTA_API_URL=${JSON.stringify(apiUrl)}`],
    { stdio: 'inherit' }
  );
  if (build.status !== 0) process.exit(build.status ?? 1);

  conferirBundle(apiUrl);
  console.log(`[build:producao] Bundle conferido em ${SAIDA}: aponta para ${apiUrl}, sem endereços de desenvolvimento.`);
}

principal();
