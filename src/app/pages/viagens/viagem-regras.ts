import {
  AlteracaoViagemMotoristaRequest, AlteracaoViagemRequest, CaminhaoResponse, MotoristaResponse, ViagemResponse
} from '../../core/modelos/api.modelos';

/**
 * Ações oferecidas na interface conforme o estado da viagem e o perfil.
 * Espelha a matriz de permissões do contrato só para **mostrar/ocultar** botões;
 * quem autoriza é o servidor (403/409 continuam tratados).
 */
export interface AcoesViagem {
  /** PUT em viagem em andamento (dados, carregamento, valor do frete). */
  editar: boolean;
  /** PUT de correção em viagem encerrada (só DONO, auditado). */
  corrigir: boolean;
  finalizar: boolean;
  /** Só DONO, só em andamento. */
  cancelar: boolean;
  incluirLancamento: boolean;
  editarLancamento: boolean;
  /** Exclusão só em andamento (encerrada: 409 para todos). */
  excluirLancamento: boolean;
  /** Auditoria e fotografias anteriores (só DONO). */
  auditoria: boolean;
}

export function acoesDaViagem(viagem: Pick<ViagemResponse, 'status'>, ehDono: boolean): AcoesViagem {
  const andamento = viagem.status === 'EM_ANDAMENTO';
  const cancelada = viagem.status === 'CANCELADA';
  return {
    editar: andamento,
    corrigir: !andamento && ehDono,
    finalizar: andamento,
    cancelar: andamento && ehDono,
    incluirLancamento: andamento || (cancelada && ehDono),
    editarLancamento: andamento || ehDono,
    excluirLancamento: andamento,
    auditoria: ehDono
  };
}

/** Dados que precisam estar gravados antes de finalizar e que o formulário de finalização coleta. */
export interface FaltasParaFinalizar {
  valorFrete: boolean;
  origem: boolean;
  destino: boolean;
  kmInicialCarregado: boolean;
}

/**
 * O corpo da finalização não aceita valor do frete, origem, destino nem km do carregamento:
 * quando faltarem, a tela envia antes um PUT com eles (fluxo do contrato). Os consumos vão
 * no próprio corpo da finalização. O servidor confere tudo de novo e lista o que faltar (400).
 */
export function faltasParaFinalizar(viagem: ViagemResponse): FaltasParaFinalizar {
  return {
    valorFrete: viagem.valorFrete === null,
    origem: !viagem.origem,
    destino: !viagem.destino,
    kmInicialCarregado: viagem.kmInicialCarregado === null
  };
}

export function temFaltas(faltas: FaltasParaFinalizar): boolean {
  return Object.values(faltas).some(Boolean);
}

/** Campos editáveis pelo PUT, como texto/número que o formulário produz. */
export interface CamposAlteracao {
  dataInicio: string;
  origem: string | null;
  destino: string | null;
  valorFrete: string | null;
  kmInicialVazio: number | null;
  kmInicialCarregado: number | null;
  consumoMedioVazio: string | null;
  consumoMedioCarregado: string | null;
  dataFim: string | null;
  kmFinalCarregado: number | null;
}

/** Converte número da resposta para o texto decimal do envio (`3500` → "3500"; `2.5` → "2.5"). */
function decimalTexto(valor: number | null): string | null {
  return valor === null ? null : String(valor);
}

/** Valores atuais da viagem, base do PUT integral (evita apagar campos não exibidos). */
export function camposAtuais(viagem: ViagemResponse): CamposAlteracao {
  const encerrada = viagem.status !== 'EM_ANDAMENTO';
  return {
    dataInicio: viagem.dataInicio,
    origem: viagem.origem,
    destino: viagem.destino,
    valorFrete: decimalTexto(viagem.valorFrete),
    kmInicialVazio: viagem.kmInicialVazio,
    kmInicialCarregado: viagem.kmInicialCarregado,
    consumoMedioVazio: decimalTexto(viagem.consumoMedioVazio),
    consumoMedioCarregado: decimalTexto(viagem.consumoMedioCarregado),
    // Em andamento, dataFim e kmFinalCarregado não são aceitos no PUT (400): vão nulos.
    dataFim: encerrada ? viagem.dataFim : null,
    kmFinalCarregado: encerrada ? viagem.kmFinalCarregado : null
  };
}

/**
 * Corpo do PUT /api/viagens/{id}, sempre completo.
 * DONO: `motoristaId` explícito (ausente removeria o responsável) — por padrão o atual.
 * MOTORISTA: sem `motoristaId` (ausente mantém o atual; outro id daria 403).
 */
export function corpoAlteracao(
  viagem: ViagemResponse,
  campos: Partial<CamposAlteracao>,
  ehDono: boolean,
  motoristaId: number | null = viagem.motoristaId
): AlteracaoViagemRequest | AlteracaoViagemMotoristaRequest {
  const corpo: AlteracaoViagemMotoristaRequest = { ...camposAtuais(viagem), ...campos };
  if (viagem.status === 'EM_ANDAMENTO') {
    corpo.dataFim = null;
    corpo.kmFinalCarregado = null;
  }
  return ehDono ? { ...corpo, motoristaId } : corpo;
}

/** Opção de motorista responsável (DONO). `null` = ninguém. */
export interface OpcaoResponsavel {
  id: number | null;
  rotulo: string;
}

/**
 * Responsáveis que o DONO pode indicar ao abrir: ninguém, ele mesmo (id do `sub` do token,
 * se disponível) e motoristas ATIVOS vinculados ao caminhão. O servidor confere de novo
 * (409 para inativo/sem vínculo).
 */
export function opcoesResponsavel(
  caminhaoId: number | null,
  motoristas: MotoristaResponse[],
  idDono: number | null,
  atual?: { id: number | null; nome: string | null }
): OpcaoResponsavel[] {
  const opcoes: OpcaoResponsavel[] = [{ id: null, rotulo: 'Ninguém' }];
  if (idDono !== null) opcoes.push({ id: idDono, rotulo: 'Eu mesmo' });
  for (const m of motoristas) {
    if (m.situacao === 'ATIVO' && caminhaoId !== null && m.caminhaoIds.includes(caminhaoId)) {
      opcoes.push({ id: m.id, rotulo: m.nome });
    }
  }
  if (atual?.id != null && !opcoes.some(o => o.id === atual.id)) {
    opcoes.push({ id: atual.id, rotulo: `${atual.nome ?? `#${atual.id}`} (atual)` });
  }
  return opcoes;
}

/** Caminhões que podem abrir viagem (o servidor recusa inativo/excluído com 409). */
export function caminhoesParaAbertura(caminhoes: CaminhaoResponse[]): CaminhaoResponse[] {
  return caminhoes.filter(c => c.status === 'ATIVO');
}

/** Rota exibida: origem → destino, sem cidades intermediárias. */
export function rota(viagem: { origem: string | null; destino: string | null }): string {
  return `${viagem.origem || '—'} → ${viagem.destino || '—'}`;
}
