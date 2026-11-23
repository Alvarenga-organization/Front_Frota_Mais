import { FiltroPeriodo } from '../../core/modelos/api.modelos';
import { hojeEmBrasilia } from '../formatacao';

export type TipoPeriodo = 'mes' | 'ano' | 'semana' | 'intervalo' | 'tudo';

export interface Periodo {
  tipo: TipoPeriodo;
  /** AAAA-MM (tipo mês). */
  mes: string;
  ano: number;
  /** Qualquer dia da semana (AAAA-MM-DD); o servidor considera segunda a domingo. */
  semana: string;
  de: string;
  ate: string;
}

/** Período inicial: mês corrente em Brasília. */
export function periodoPadrao(hoje = hojeEmBrasilia()): Periodo {
  return { tipo: 'mes', mes: hoje.slice(0, 7), ano: Number(hoje.slice(0, 4)), semana: hoje, de: '', ate: '' };
}

/**
 * Converte a escolha da tela num filtro aceito pela API (um tipo por vez, sem misturar).
 * Devolve `null` se o período estiver incompleto (ex.: intervalo sem datas).
 */
export function paraFiltro(periodo: Periodo): FiltroPeriodo | null {
  switch (periodo.tipo) {
    case 'mes': {
      const [ano, mes] = periodo.mes.split('-').map(Number);
      return ano && mes ? { ano, mes } : null;
    }
    case 'ano':
      return Number.isInteger(periodo.ano) ? { ano: periodo.ano } : null;
    case 'semana':
      return periodo.semana ? { semana: periodo.semana } : null;
    case 'intervalo':
      if (!periodo.de && !periodo.ate) return null;
      return { ...(periodo.de ? { de: periodo.de } : {}), ...(periodo.ate ? { ate: periodo.ate } : {}) };
    default:
      return {};
  }
}

/** Os `quantidade` meses terminando no mês informado (AAAA-MM), do mais antigo ao mais recente. */
export function mesesAte(mesFinal: string, quantidade: number): { ano: number; mes: number }[] {
  const [anoFinal, mesFinalNum] = mesFinal.split('-').map(Number);
  const meses: { ano: number; mes: number }[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const indice = anoFinal * 12 + (mesFinalNum - 1) - i;
    meses.push({ ano: Math.floor(indice / 12), mes: (indice % 12) + 1 });
  }
  return meses;
}
