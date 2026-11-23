# Status da integração do front-end

- **Atualizado em:** 23/11/2026
- **Branch:** `feat/integracao-http` (a partir de `origin/main` `4971bfc`). Os commits de 19/11 foram recuperados do
  Codespaces expirado pela exportação de alterações para a branch remota `codespace-ideal-space-guide-77vvwwxwjp5p2rv99`.
- **Back-end:** em 19/11 não estava disponível; a comunicação foi validada só com testes automatizados
  (`HttpTestingController`). Em **23/11** o contrato HTTP foi validado contra a API real do time de back-end,
  pelo proxy do `ng serve` (seção 4A). O fluxo completo pela interface (E2E no navegador) **ainda não foi feito**.

Legenda de contrato: **Confirmado** = comportamento descrito no contrato da API consultado; **Inferido** = evidência
parcial, precisa ser conferido na API real.

## 1. Resumo

| Classificação | Itens |
|---|---|
| **Implementado e validado por testes automatizados** | Infraestrutura HTTP, interceptor, sessão/JWT, guards, erros; login, registro, ativação de convite, troca de senha, logout; caminhões; motoristas e convites; viagens (lista, abertura, detalhe, alteração, finalização, cancelamento, correção, histórica, auditoria); lançamentos; manutenções; dashboard; relatórios |
| **Contrato HTTP validado contra a API real (23/11, perfil DONO)** | Autenticação, caminhões, motoristas (listagem e convite com `503`), viagens, lançamentos, finalização, cancelamento, histórica, auditoria, manutenções e indicadores (seção 4A) |
| **Ainda não validado contra a API real** | Perfil MOTORISTA (sem SMTP para ativar convite); ativação de convite; reenviar/cancelar convite; fluxo pelas telas no navegador (E2E) |
| **Bloqueado por falta de informação ou contrato** | Publicação em produção (estratégia de CORS/domínio); convite de ponta a ponta (SMTP e URL de ativação no servidor); itens que a API não oferece (seção 5) |

## 2. Etapas

| Etapa | Situação | Commit |
|---|---|---|
| Auditoria (branch, Node 24.22.3, contexto, linha de base 41 testes) | Concluída | — |
| Infra HTTP, erros, sessão, autenticação, telas de acesso, Conta | Concluída | `de5b4a8` |
| Caminhões e motoristas | Concluída | `e6e1ce7` |
| Viagens e lançamentos | Concluída | `58633fa` |
| Manutenções | Concluída | `3d3f614` |
| Dashboard e relatórios | Concluída | `fff0d5d` |
| Viagem histórica (tela) | Concluída | `0d80448` |
| Documentação e devcontainer | Concluída | commit de documentação desta branch |
| Validação do contrato HTTP contra o back-end real (DONO) | Concluída em 23/11 (seção 4A) | `feat(integracao): conecta frontend a API real` |
| Validação do perfil MOTORISTA e E2E no navegador | **Pendente** | — |

**Testes:** 187 aprovados, 0 falhas (`npm run test:ci`), contra 41 na linha de base. **Build de produção:** aprovado,
sem avisos (`npm run build`, ~653 kB iniciais). O build de produção não contém URL de desenvolvimento nem dados de teste.
O proxy foi verificado com `ng serve`: `/api` é encaminhado para `localhost:8080`.

## 3. Endpoints usados (41 do contrato)

| Endpoint | Serviço / tela | Contrato |
|---|---|---|
| `POST /api/auth/login`, `/auth/registro`, `/convites/ativacao` | `AuthService` / Login, Criar conta, Ativar conta | Confirmado |
| `POST /api/auth/senha` | `AuthService` / Conta | Confirmado |
| `GET/POST /api/caminhoes`, `GET/PUT/DELETE /api/caminhoes/{id}` | `CaminhoesService` / Caminhões | Confirmado |
| `GET/POST /api/motoristas`, `GET/PUT /api/motoristas/{id}`, `PUT .../caminhoes`, `POST/DELETE .../convite` | `MotoristasService` / Motoristas | Confirmado (corpo da resposta de reenviar/cancelar convite: **inferido**, não é usado) |
| `GET/POST /api/viagens`, `GET/PUT /api/viagens/{id}`, `POST .../finalizar`, `POST .../cancelar`, `POST /api/viagens/historicas` | `ViagensService` / Viagens | Confirmado |
| `GET .../alteracoes`, `GET .../fotografias-anteriores` | `ViagensService` / detalhe (DONO) | Confirmado |
| `POST/PUT/DELETE /api/viagens/{id}/abastecimentos|pedagios|despesas-extras[/{id}]` | `LancamentosService` / detalhe | Confirmado |
| `GET/POST /api/manutencoes`, `GET/PUT/DELETE /api/manutencoes/{id}` | `ManutencoesService` / Manutenções | Confirmado |
| `GET /api/viagens/indicadores`, `/indicadores/por-caminhao` | `IndicadoresService` / Dashboard, Relatórios | Confirmado |

`GET /api/caminhoes/{id}`, `GET /api/motoristas/{id}` e `GET /api/manutencoes/{id}` estão nos serviços, mas as telas
usam as listas.

## 4. O que conferir quando o back-end estiver disponível

Para cada item: método/rota, corpo enviado, resposta, perfil e erros. Os testes automatizados descrevem exatamente
o que o front-end envia e espera.

1. **Proxy e autenticação:** `npm start` com o back-end na 8080; login → requisições seguintes com `Authorization:
   Bearer`; login/registro/ativação **sem** o cabeçalho; token vencido ou usuário desativado → `401` → volta ao login
   com aviso; `403` não desloga.
2. **Formato de erro:** confirmar `{ status, erro, detalhes }` em `400/401/403/404/409/415/503/500` e o idioma das
   mensagens de validação de campo.
3. **Claims do JWT:** `sub` numérico (id do usuário) e `exp` em segundos — usados para "Eu mesmo" e expiração local.
4. **Registro:** corpo `{ nomeEmpresa, nome, email, senha }`, `201` com token; `409` e-mail duplicado.
5. **Ativação:** rota `/ativar-conta?token=...` configurada no servidor; token some da barra de endereço; `400` convite
   inválido ou senha fraca.
6. **Caminhões:** `incluirExcluidos=true` só quando marcado; `PUT` com todos os campos e `status`; inativar/reativar por
   `PUT`; `409` ao inativar/excluir com viagem em andamento; caminhões antigos sem marca/eixos.
7. **Motoristas:** `503` sem SMTP (nada gravado); `PUT` com `ativo=false` para conta pendente; vínculos com lista
   completa; reenviar (`POST`, sem corpo) e cancelar convite (`DELETE`).
8. **Abertura de viagem (inferido):** MOTORISTA envia `motoristaId: null` (o servidor deve assumir o próprio usuário).
   DONO envia o id escolhido, o próprio `sub` ou `null`.
9. **PUT de viagem:** DONO sempre com `motoristaId` explícito; MOTORISTA **sem** o campo (ausente mantém); em andamento,
   `dataFim`/`kmFinalCarregado` nulos.
10. **Finalização (inferido):** consumos enviados no corpo da finalização satisfazem a exigência de consumo; quando faltam
    valor do frete, origem, destino ou km do carregamento, a tela faz `PUT` antes e só então `POST .../finalizar`.
11. **Cancelamento:** `motivo` obrigatório; `dataFim` opcional (padrão hoje no servidor).
12. **Lançamentos:** valores como texto (`"1553.10"`), hora `HH:MM`; resposta sem rentabilidade → a tela recarrega o
    detalhe; `409` em finalizada; `403` do MOTORISTA em encerrada.
13. **Rentabilidade e indicadores:** campos nulos para o MOTORISTA; nulos exibidos como "não calculado";
    período vazio com divisões nulas; série do dashboard = 7 chamadas a `/indicadores` (período + 6 meses).
14. **Datas:** "hoje" calculado em `America/Sao_Paulo`; instantes exibidos no horário de Brasília.

## 4A. Validação contra a API real (23/11/2026)

### Configuração

- **Alvo:** back-end do time rodando no GitHub Codespaces, porta 8080 encaminhada como pública:
  `https://animated-meme-q74jxw9ggq4whxrvx-8080.app.github.dev` (endereço **temporário**, muda a cada codespace).
- **Proxy:** `proxy.conf.mjs` lê o alvo de `FROTA_API_ALVO` (padrão `http://localhost:8080`); a URL não fica no código.
  `changeOrigin` passou a `true`, para que o cabeçalho `Host` enviado seja o do alvo: o encaminhamento de portas
  do Codespaces roteia por ele, e com `false` iria `localhost:4200` (a validação foi feita só com `true`). Para o
  alvo local o efeito é nulo.
- **Comando:** `FROTA_API_ALVO=<url do back-end> npx ng serve` → o navegador chama `http://localhost:4200/api`,
  sem CORS.
- **Método:** script Node fora do repositório chamando `localhost:4200/api` (portanto, passando pelo proxy) com os
  mesmos corpos que os serviços do front enviam, e comparando as chaves de cada resposta com os tipos de
  `src/app/core/modelos/api.modelos.ts`. Não exercita os componentes Angular.

### Resultado

**60 verificações com o status esperado; nenhuma divergência de campo entre os DTOs do front e as respostas.**
Uma 61ª verificação ficou fora da contagem por **expectativa incorreta do próprio teste**: enviava `POST` sem corpo
esperando `415`, e a API respondeu `400` ("Corpo da requisição ausente ou ilegível"), o que está correto. O `415`
é para `Content-Type` não suportado; conferido à parte (`text/plain` → `415`, "Envie o corpo como application/json.").

| Módulo | Verificado |
|---|---|
| Autenticação | registro `201`; e-mail duplicado `409`; login `200` e senha errada `401`; sem token e token inválido `401`; troca de senha com atual errada `400` (sem invalidar a sessão) e válida `204`; JWT com `sub` numérico e `exp` (8 h) |
| Caminhões | `POST` com `status`/tanque nulos e preenchidos; placa normalizada (`tg-…` → `TG…`); placa duplicada `409`; validação `400`; `PUT` integral; lista com e sem excluídos; inexistente `404`; inativar e excluir com viagem em andamento `409` |
| Motoristas | listagem; convite → `503` sem SMTP, nada gravado |
| Viagens | abertura do DONO com `motoristaId` próprio e com `null`, com abastecimento anterior ao início; viagem em andamento no mesmo caminhão `409`; data futura `400`; `PUT` em andamento com `motoristaId` explícito; lista e filtros `status`/`caminhaoId`; detalhe com rentabilidade ao vivo (`resultadoConsolidadoEm` nulo, `pendencias`); finalização com fotografia; finalizar sem frete/destino `400`; cancelar sem motivo `400`; cancelamento `200`; cancelar finalizada `409`; correção de finalizada (`PUT` auditado); `alteracoes` e `fotografias-anteriores`; histórica `201` com lançamentos; inexistente `404` |
| Lançamentos | abastecimento (Arla e diesel), pedágio e despesa: `POST`, `PUT`, `DELETE`; fora do período `400`; diesel com preço implausível `400`; novo lançamento e exclusão em finalizada `409`; despesa em cancelada (DONO) `201` |
| Manutenções | `POST`, `PUT`, lista com filtro `caminhaoId`/`de`/`ate`, data futura `400`, `DELETE` `204` |
| Indicadores | `ano`+`mes`, `de`/`ate`, `semana`, período vazio (divisões `null`, não zero), `por-caminhao` |
| Formato de erro | `{ status, erro, detalhes }` em todos os `4xx`/`503` recebidos |
| Datas | instantes em UTC (`…Z`); `hora` volta como `HH:MM:SS` (a tela já exibe `HH:MM`) |

DTOs conferidos campo a campo: `AutenticacaoResponse`, `ErroApi`, `CaminhaoResponse`, `MotoristaResponse`,
`ViagemResponse`, `ViagemResumoResponse`, `RentabilidadeResponse`, `PoliticaCalculo`, `AbastecimentoResponse`,
`PedagioResponse`, `DespesaExtraResponse`, `AlteracaoViagemResponse`, `FotografiaAnteriorResponse`,
`IndicadoresResponse`, `IndicadoresPorCaminhaoResponse`, `ManutencaoResponse`. Os corpos de requisição são os
dos tipos `*Request` do mesmo arquivo e foram aceitos pela API.

### Limitações e pendências

- **Sem E2E pela interface:** as telas não foram percorridas no navegador contra a API real; a validação cobre o
  contrato HTTP e o proxy, não renderização, navegação, guards nem mensagens na tela.
- **Perfil MOTORISTA não validado:** o back-end do Codespaces não tem SMTP, o convite responde `503` e não há como
  ativar uma conta de motorista. Ficam pendentes: ativação de convite, reenviar/cancelar convite, campos financeiros
  nulos para o motorista, `403` nas rotas do DONO e `PUT` de viagem sem `motoristaId`.
- **Mensagens de validação em inglês:** erros de Bean Validation chegam como `"modelo: must not be blank"`,
  `"eixos: must be greater than or equal to 1"`, `"motivo: must not be blank"`. O front exibe `detalhes` sem
  reescrever; a tradução cabe ao back-end (apontado ao time).
- **Dados de teste no back-end:** a validação criou uma empresa fictícia de teste (nome iniciado por `TESTE FRONT`),
  com caminhões, viagens e manutenções fictícios. Ela é isolada das demais empresas pelo próprio back-end e
  **não foi removida**, para permitir conferência pelo time.

## 5. Lacunas da API (apresentadas na interface, não simuladas)

Sem recuperação de senha ("Esqueceu sua senha?" informa que não existe), sem `/me` (nome e perfil vêm do login e ficam
na sessão), sem edição de empresa/perfil/e-mail, sem refresh token nem logout no servidor, sem paginação, sem filtro por
data em `GET /api/viagens` (Relatórios filtra localmente os finalizados pela data de descarga do período devolvido pelo
servidor), sem série mensal (uma chamada por mês), sem exportação PDF/Excel, sem exclusão/reabertura de viagem, sem
abastecimento avulso, sem autor de cada lançamento.

## 6. Decisões que exigem aprovação do proprietário

1. **Estratégia de CORS/publicação** em produção (o build usa `/api` relativo, supondo mesmo domínio ou proxy reverso).
2. **Rótulos de indicadores:** a tela usa "Margem" (valor ponderado do servidor) em vez de "Margem Média", e
   "Lucro por km" (`lucroPorKm`) em vez de "R$/Km"; o card "Lucro Líquido" do Figma virou "Lucro dos fretes"
   (`lucroTotal`), com o "Resultado financeiro do período" (`resultadoFinanceiroPeriodo`) em bloco próprio. Confirmar.
3. **Km total na lista de viagens:** exibido como "vazio / carregado" (sem somar no cliente). Confirmar.
4. **MOTORISTA e lançamentos de outros:** a interface reflete a API atual (pode corrigir/excluir qualquer lançamento
   da viagem em andamento). Restringir depende de decisão e de mudança no back-end.
5. **Despesa real após a data do cancelamento** (hoje recusada pelo servidor) e demais pontos financeiros em aberto:
   a interface apenas mostra a mensagem do servidor.
6. **`LEIA-ME.md`** descreve o modelo didático original; recebeu um aviso apontando para o `README.md`. Remover ou
   reescrever é decisão do responsável.

## 7. Riscos e limitações conhecidas

- **Token no `sessionStorage`** (decisão aprovada): legível por script injetado. Mitigação: sem HTML externo no DOM,
  sem token em URL/log. Uma CSP no servidor de publicação reduziria o risco (pendente com a publicação).
- **Expiração local** usa o relógio do navegador; o `401` do servidor continua sendo a fonte de verdade.
- **Validações no cliente** são só de formato (obrigatórios, casas decimais, limites); regras de negócio (sobreposição
  de datas, preço do diesel, tanque, vínculos, estado da viagem) ficam no servidor e aparecem como mensagem dele.
- **Gráficos** desenham proporções calculadas no cliente apenas para a forma visual; os valores exibidos são os do servidor.
- **Volume:** sem paginação na API, listas grandes são renderizadas inteiras.
- **Responsividade e acessibilidade** foram cuidadas no código (rótulos, `aria-*`, foco, folha inferior no celular), mas
  não houve revisão visual em navegador real nesta etapa nem conferência com o Figma das telas novas.

## 8. Como retomar

1. `git log --oneline origin/main..feat/integracao-http` para ver os commits locais.
2. `npm ci && npm run test:ci && npm run build` para confirmar o estado. No Windows sem o Chromium do Puppeteer,
   defina `CHROME_BIN` com o caminho do Chrome instalado.
3. Subir o front apontando para o back-end (seção 4A) e fazer o E2E pelas telas; com SMTP disponível, validar o
   perfil MOTORISTA (itens 5, 7, 8, 9 e 13 da seção 4). Registrar divergências aqui.
