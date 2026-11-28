# Frota+ — front-end

**Gestão que move resultados.** Interface web (Angular) do Frota+, sistema de gestão de viagens, custos e
rentabilidade para pequenos transportadores. O back-end (Java/Spring Boot) é a fonte de verdade de regras,
permissões e cálculos; este front-end exibe, coleta e orienta.

Situação da integração, pendências e o que conferir contra a API real: [`docs/STATUS_INTEGRACAO_FRONTEND.md`](docs/STATUS_INTEGRACAO_FRONTEND.md).

## Ambiente

| Item | Versão |
|---|---|
| Node.js | `^20.19 \|\| ^22.12 \|\| ^24` (referência: **24.22.3**) |
| npm | 11 (vem com o Node 24) |
| Angular / CLI | 20.3 · Angular Material/CDK 20.2 · TypeScript 5.9 |

### Codespaces / Dev Container (opcional)

`.devcontainer/devcontainer.json` reproduz o ambiente: Ubuntu 24.04, Node 24.22.3, bibliotecas de sistema do
Chromium headless (script `.devcontainer/instalar-bibliotecas-chromium.sh`) e `npm ci`. Para usar num
Codespace novo, basta criá-lo a partir do repositório; num Codespace existente, use
**Codespaces: Rebuild Container** (o rebuild recria o contêiner — salve o trabalho antes).

## Executar

```bash
npm ci          # instala exatamente o package-lock
npm start       # ng serve em http://localhost:4200
```

### Desenvolvimento integrado com o back-end

O front-end chama sempre `/api` na própria origem. Em desenvolvimento, o `ng serve` usa
[`proxy.conf.mjs`](proxy.conf.mjs) para encaminhar `/api` ao back-end, **sem depender de CORS**:

1. Suba o back-end (repositório próprio) na porta **8080**, apontando para um banco montado pelas migrations
   (combine com o responsável pelo back-end).
2. `npm start` neste repositório.
3. Para outro endereço de back-end: `FROTA_API_ALVO=http://host:porta npm start`.

Sem back-end no ar, as telas mostram o estado de erro com "Tentar de novo" (nenhum dado fictício é exibido).

Para testar o convite de motoristas de ponta a ponta, o back-end precisa de SMTP e da URL da página de ativação
deste front-end: `http://<host>/ativar-conta` (o link do e-mail acrescenta `?token=...`).

### Build

```bash
npm run build                                               # /api relativo
FROTA_API_URL=https://api.exemplo.com npm run build:producao  # URL pública da API
```

Saída em `dist/modelo-projeto-integrador/browser`.

- `npm run build` usa `/api` relativo (`src/environments/environment.ts`): o front-end precisa ser servido no mesmo
  domínio da API ou atrás de um proxy reverso que encaminhe `/api`.
- `npm run build:producao` ([`scripts/build-producao.mjs`](scripts/build-producao.mjs)) lê `FROTA_API_URL` — só a
  **origem** https da API, sem caminho; o `/api` é acrescentado pelo script. Recusa http, usuário/senha na URL,
  localhost, IPs privados e Codespaces, e depois do build confere que o bundle aponta para a URL informada e não
  contém endereços de desenvolvimento. A URL não é segredo (vai para o navegador), mas fica fora do código.
  Com API em outro domínio, o back-end precisa liberar CORS **para a origem do front-end** (nunca `*`).
  Também recusa endereços `*.vercel.app` (a API não é servida pela Vercel). Sem a variável, **o build falha**.

Para conferir um bundle já gerado: `grep -o "code\.run/api" dist/modelo-projeto-integrador/browser/*.js` deve achar a
URL da API, e nenhum arquivo pode conter `localhost:`, `.github.dev` nem `"/api/` relativo.

### Publicação na Vercel

O [`vercel.json`](vercel.json) fixa a configuração (o painel não precisa de ajuste manual de build):

| Item | Valor |
|---|---|
| Instalação | `npm ci` |
| Build | `npm run build:producao` |
| Saída | `dist/modelo-projeto-integrador/browser` |
| SPA | toda rota que não começa com `/api/` devolve `index.html`; `/api/*` no domínio da Vercel dá `404` de propósito |
| Variável | `FROTA_API_URL` em *Settings → Environment Variables* (Production), com a **origem** https da API, sem `/api` |

A origem publicada do front-end é `https://front-frota-mais.vercel.app`; é ela que o back-end libera no CORS. Deploys de
*preview* têm outra origem e, por isso, não conversam com a API enquanto o CORS listar só a de produção.
Nenhum segredo (banco, JWT, SMTP) pertence ao front-end: a única variável é a URL pública da API.

As chamadas à API têm tempo-limite de 90 s; ao estourar, a tela mostra "Tempo esgotado" avisando que a operação pode
ter sido gravada (não há repetição automática).

### Contrato da API (1.2)

Os tipos ficam só em `src/app/core/modelos/api.modelos.ts`. A partir do contrato 1.2 a API responde `400` a campo
desconhecido, então os corpos enviados precisam ter exatamente os campos dos tipos `*Request`.

- **Abastecimento:** `quilometragem` (odômetro, km inteiro de 0 a 9.999.999) substitui `hora`, que não é mais enviada.
  É obrigatória em abastecimento novo (lançamento, abertura da viagem e viagem histórica); decimal, texto ou valor fora
  da faixa bloqueiam o envio, sem arredondar.
- **Registros antigos:** `quilometragem: null` aparece como "km não informada" (nunca zero; a `hora` antiga não é
  exibida). Na correção, o campo pode continuar vazio; depois de informado, não pode ser apagado.
- Pedágio (data e valor pago) e despesa extra (descrição livre, data e valor) não mudaram.

## Testes

```bash
npm test        # Karma + Jasmine, observando alterações
npm run test:ci # uma execução, Chromium headless
```

O Chromium headless vem do Puppeteer (`~/.cache/puppeteer`, fora do repositório; `CHROME_BIN` tem prioridade).
Em contêineres Linux ele precisa das bibliotecas de sistema listadas no script do devcontainer.

As chamadas HTTP são verificadas com `HttpTestingController` (método, URL, corpo, respostas e erros). Os dados de
teste ficam em `src/testes/dados/` e **nunca** são usados pela aplicação.

## Arquitetura

```text
src/app/
  core/
    modelos/api.modelos.ts   tipos fiéis aos DTOs da API (único lugar)
    http/                    API_URL, normalização de erros, interceptor de autenticação
    sessao/                  SessaoService (token, nome, perfil), leitura do JWT, guards
    api/                     um serviço por domínio: auth, caminhões, motoristas, viagens,
                             lançamentos, manutenções, indicadores
  compartilhado/             janela (modal/folha inferior), confirmação, estados de lista,
                             filtro de período, pipes (moeda, número, data, instante), validadores
  layout/                    menu lateral, topo e navegação inferior por perfil
  pages/<pagina>/            módulos lazy (NgModules, componentes standalone: false)
```

- **Componentes** cuidam da interação e dos estados (carregando, vazio, sucesso, falha); **serviços** fazem as
  chamadas HTTP. Nenhum componente monta URL nem guarda token.
- **Nada financeiro é calculado no navegador**: custos, lucro, margem, rentabilidade e indicadores vêm prontos do
  servidor. Valor nulo é exibido como "não calculado", nunca como zero.

### Autenticação e sessão

- Login, criação de conta e ativação de convite devolvem `{ token, nome, perfil }` e abrem a sessão.
- A sessão fica no `sessionStorage` (vale para a aba). Isso **não** protege o token contra XSS: por isso o código
  não usa `innerHTML` nem `bypassSecurityTrust*` com dados externos, e nada de sessão vai para logs ou URLs.
- O payload do JWT é lido **sem verificar assinatura**, só para a interface: expiração (`exp`) e id do usuário (`sub`,
  usado em "eu mesmo" como responsável). Quem autoriza é o servidor, a cada requisição.
- Guards: rotas internas exigem sessão local válida (token não vencido); rotas com `data.perfis` (Dashboard,
  Motoristas, Relatórios, Manutenções) são só do DONO. Guards e menus ocultos são experiência, não segurança.
- Sair é local (não existe logout no servidor): limpa a sessão e fecha janelas abertas.
- Não há refresh token, recuperação de senha nem endpoint de "usuário atual".

### Interceptor e erros

`core/http/autenticacao.interceptor.ts`:

- anexa `Authorization: Bearer <token>` só às rotas protegidas da própria API (não em login, registro e ativação,
  nem em outros domínios);
- `401` numa rota protegida encerra a sessão e leva ao login uma única vez, com aviso;
- `401` no login é credencial inválida (tratado pela tela); `403` e demais erros seguem para a tela, sem deslogar.

`core/http/falha-api.ts` converte qualquer erro em `{ status, erro, detalhes }`: usa os `detalhes` do servidor,
nunca expõe HTML, pilhas ou detalhes de `5xx`, e identifica falha de conexão (`status 0`) e proxy sem back-end.
As decisões são tomadas pelo `status`, nunca pelo texto. Requisições não são repetidas automaticamente.

## Funcionalidades

Telas integradas à API: login, criar conta, ativar convite, conta (troca de senha), caminhões, motoristas e
convites, viagens (lista, abertura, detalhe, carregamento/alteração, finalização, cancelamento, correção de
encerrada, viagem histórica, auditoria), lançamentos (diesel, Arla, pedágios, despesas extras), manutenções,
dashboard e relatórios. Ver a situação de cada uma no relatório de status.
