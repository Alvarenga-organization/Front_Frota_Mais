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
npm run build   # produção em dist/modelo-projeto-integrador/browser
```

Em produção a URL da API é `/api` relativa (`src/environments/environment.ts`): o front-end precisa ser servido no
mesmo domínio da API ou atrás de um proxy reverso que encaminhe `/api`. A estratégia de publicação e de CORS ainda
está **pendente de decisão**. A hospedagem precisa devolver `index.html` para rotas desconhecidas (SPA).

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
