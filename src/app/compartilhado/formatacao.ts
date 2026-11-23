import { Pipe, PipeTransform } from '@angular/core';
import { DataIso, InstanteUtc, SituacaoMotorista, StatusCaminhao, StatusViagem } from '../core/modelos/api.modelos';

/** Fuso usado para exibir instantes e calcular "hoje" (regra do produto). */
export const FUSO_BRASILIA = 'America/Sao_Paulo';

const FORMATO_INSTANTE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_BRASILIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

/** Instante UTC da API → "dd/mm/aaaa hh:mm" no horário de Brasília. */
export function formatarInstante(instante: InstanteUtc | null | undefined): string {
  if (!instante) return '—';
  const data = new Date(instante);
  return Number.isNaN(data.getTime()) ? '—' : FORMATO_INSTANTE.format(data).replace(',', '');
}

const FORMATO_MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const FORMATO_DIA_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_BRASILIA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Texto exibido para valores calculados nulos: nulo **não** é zero. */
export const NAO_CALCULADO = 'não calculado';

/** Valor monetário da API → "R$ 1.500,00". Nulo/indefinido → "—" (nunca R$ 0,00). */
export function formatarMoeda(valor: number | null | undefined, vazio = '—'): string {
  return valor === null || valor === undefined || Number.isNaN(valor) ? vazio : FORMATO_MOEDA.format(valor);
}

/** Número da API em pt-BR com até `casas` decimais. Nulo → "—". */
export function formatarNumero(valor: number | null | undefined, casas = 2, vazio = '—'): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return vazio;
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

/** Data `AAAA-MM-DD` → "dd/mm/aaaa", sem conversão de fuso (é um dia, não um instante). */
export function formatarData(data: DataIso | null | undefined): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '—';
}

/** "Hoje" em America/Sao_Paulo, no formato da API (regra do produto; não usar UTC). */
export function hojeEmBrasilia(agora: Date = new Date()): DataIso {
  return FORMATO_DIA_ISO.format(agora);
}

@Pipe({ name: 'moeda', standalone: false })
export class MoedaPipe implements PipeTransform {
  transform(valor: number | null | undefined, vazio = '—'): string {
    return formatarMoeda(valor, vazio);
  }
}

@Pipe({ name: 'numero', standalone: false })
export class NumeroPipe implements PipeTransform {
  transform(valor: number | null | undefined, casas = 2, vazio = '—'): string {
    return formatarNumero(valor, casas, vazio);
  }
}

@Pipe({ name: 'data', standalone: false })
export class DataPipe implements PipeTransform {
  transform(valor: DataIso | null | undefined): string {
    return formatarData(valor);
  }
}

@Pipe({ name: 'instante', standalone: false })
export class InstantePipe implements PipeTransform {
  transform(valor: InstanteUtc | null | undefined): string {
    return formatarInstante(valor);
  }
}

export const ROTULO_STATUS_CAMINHAO: Record<StatusCaminhao, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  EXCLUIDO: 'Excluído'
};

export const ROTULO_SITUACAO_MOTORISTA: Record<SituacaoMotorista, string> = {
  CONVITE_PENDENTE: 'Convite pendente',
  ATIVO: 'Ativo',
  INATIVO: 'Inativo'
};

export const ROTULO_STATUS_VIAGEM: Record<StatusViagem, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Concluída',
  CANCELADA: 'Cancelada'
};

export const CLASSE_SELO_VIAGEM: Record<StatusViagem, string> = {
  EM_ANDAMENTO: 'selo selo-alerta',
  FINALIZADA: 'selo selo-sucesso',
  CANCELADA: 'selo selo-perigo'
};
