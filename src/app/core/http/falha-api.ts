import { HttpErrorResponse } from '@angular/common/http';

/**
 * Falha de uma chamada à API, já no formato único da aplicação.
 * `status` 0 = sem resposta do servidor (rede, servidor fora do ar, proxy sem destino).
 * Decida o comportamento pelo `status`; mostre `detalhes` ao usuário.
 */
export interface FalhaApi {
  status: number;
  erro: string;
  detalhes: string[];
}

const MENSAGEM_PADRAO: Record<number, string> = {
  0: 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.',
  400: 'Os dados enviados não foram aceitos.',
  401: 'Sua sessão não é válida. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Registro não encontrado.',
  405: 'Operação não permitida.',
  409: 'Os dados mudaram ou estão em conflito. Atualize a tela e tente de novo.',
  415: 'Formato de dados não suportado.',
  429: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  500: 'Erro interno no servidor. Tente de novo mais tarde.',
  502: 'O servidor não está acessível no momento. Tente de novo mais tarde.',
  503: 'Serviço indisponível no momento. Nada foi gravado.',
  504: 'O servidor demorou para responder. Tente de novo mais tarde.'
};

const CATEGORIA_PADRAO: Record<number, string> = {
  0: 'Sem conexão',
  400: 'Dados inválidos',
  401: 'Não autenticado',
  403: 'Acesso negado',
  404: 'Não encontrado',
  409: 'Conflito de dados',
  503: 'Serviço indisponível'
};

const MENSAGEM_SEM_BACKEND = 'O servidor não respondeu corretamente. Ele pode estar fora do ar; tente de novo em instantes.';

function mensagemPadrao(status: number): string {
  return MENSAGEM_PADRAO[status] ?? (status >= 500 ? MENSAGEM_PADRAO[500] : 'Não foi possível concluir a operação.');
}

/** Corpo `{ status, erro, detalhes }` do back-end; qualquer outro formato é descartado. */
function corpoDoBackend(corpo: unknown): { erro: string | null; detalhes: string[] } | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const { erro, detalhes } = corpo as { erro?: unknown; detalhes?: unknown };
  const lista = Array.isArray(detalhes) ? detalhes.filter((d): d is string => typeof d === 'string' && d.trim() !== '') : [];
  if (typeof erro !== 'string' && !lista.length) return null;
  return { erro: typeof erro === 'string' ? erro : null, detalhes: lista };
}

/**
 * Converte qualquer erro de uma chamada HTTP em `FalhaApi`.
 * Nunca repassa ao usuário HTML, pilha de execução ou outro conteúdo que não seja
 * a mensagem padronizada do back-end; nesses casos usa um texto genérico pelo status.
 */
export function normalizarFalha(erro: unknown): FalhaApi {
  if (erro instanceof HttpErrorResponse) {
    const status = erro.status;
    const corpoValido = corpoDoBackend(erro.error);
    if (status >= 500 && status !== 503 && !corpoValido) {
      // Resposta 5xx sem o corpo padrão do back-end: veio do proxy ou de outro intermediário
      // (ex.: back-end fora do ar no desenvolvimento), não da aplicação.
      return { status, erro: 'Servidor indisponível', detalhes: [MENSAGEM_SEM_BACKEND] };
    }
    // Em 500 o back-end já devolve mensagem genérica; mesmo assim não arriscamos expor detalhes internos.
    const corpo = status >= 500 && status !== 503 ? null : corpoValido;
    return {
      status,
      erro: corpo?.erro ?? CATEGORIA_PADRAO[status] ?? 'Erro',
      detalhes: corpo?.detalhes.length ? corpo.detalhes : [mensagemPadrao(status)]
    };
  }
  return { status: -1, erro: 'Erro inesperado', detalhes: ['Ocorreu um erro inesperado. Tente de novo.'] };
}
