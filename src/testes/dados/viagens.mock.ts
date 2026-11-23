/**
 * DADOS DE TESTE: fictícios, usados só nos testes automatizados (nunca no app).
 * Formatos de ViagemResponse e ViagemResumoResponse do contrato.
 */
import { RentabilidadeResponse, ViagemResponse, ViagemResumoResponse } from '../../app/core/modelos/api.modelos';

export const RENTABILIDADE_COMPLETA: RentabilidadeResponse = {
  receita: 3500, kmVazio: 80, kmCarregado: 500, litrosEstimadosVazio: 25, litrosEstimadosCarregado: 200,
  precoMedioDiesel: 6.4, origemPrecoDiesel: 'ABASTECIMENTOS_DA_VIAGEM', viagemReferenciaPrecoDieselId: null,
  referenciaPrecoConsolidadaEm: '2025-03-07T19:40:00Z', custoDieselVazio: 160, custoDieselCarregado: 1280, custoArla: 0,
  pedagios: 65.5, despesasExtras: 0, custoOperacionalTotal: 1505.5, lucro: 1994.5, margemPercentual: 56.99,
  calculoCompleto: true, pendencias: [],
  politicaCalculo: { versao: 'rentabilidade-v1', precoDieselMinimo: 1, precoDieselMaximo: 30, consumoMinimo: 0.5, consumoMaximo: 10 },
  resultadoConsolidadoEm: '2025-03-07T19:40:00Z'
};

/** Em andamento, saiu vazio, sem carregamento, sem frete nem destino: rentabilidade incompleta. */
export function viagemEmAndamento(parcial: Partial<ViagemResponse> = {}): ViagemResponse {
  return {
    id: 205, caminhaoId: 1, placa: 'BCB8H89', motoristaId: 31, motoristaNome: 'Carlos Lima', status: 'EM_ANDAMENTO',
    origem: 'São Paulo', destino: null, dataInicio: '2025-03-05', dataFim: null, valorFrete: null,
    kmInicialVazio: 10400, kmFinalVazio: null, kmInicialCarregado: null, kmFinalCarregado: null,
    consumoMedioVazio: 3.2, consumoMedioCarregado: null,
    criadaEm: '2025-03-05T11:02:10Z', atualizadaEm: '2025-03-05T11:02:10Z', finalizadaEm: null,
    cadastroRetroativoEm: null, canceladaEm: null, motivoCancelamento: null,
    abastecimentosDiesel: [{ id: 901, tipo: 'DIESEL', data: '2025-03-04', hora: '18:30:00', litros: 100, valorTotal: 640 }],
    abastecimentosArla: [],
    pedagios: [{ id: 950, data: '2025-03-05', valor: 25.4 }],
    despesasExtras: [{ id: 960, descricao: 'Almoço do motorista', data: '2025-03-05', valor: 35 }],
    rentabilidade: {
      ...RENTABILIDADE_COMPLETA, receita: null, kmCarregado: null, custoDieselCarregado: null, custoOperacionalTotal: null,
      lucro: null, margemPercentual: null, calculoCompleto: false, resultadoConsolidadoEm: null,
      pendencias: ['Valor do frete não informado.', 'Km do carregamento não informado.']
    },
    ...parcial
  };
}

export function viagemFinalizada(parcial: Partial<ViagemResponse> = {}): ViagemResponse {
  return viagemEmAndamento({
    status: 'FINALIZADA', destino: 'Palmital', dataFim: '2025-03-07', valorFrete: 3500, kmFinalVazio: 10480,
    kmInicialCarregado: 10480, kmFinalCarregado: 10980, consumoMedioCarregado: 2.5, finalizadaEm: '2025-03-07T19:40:00Z',
    rentabilidade: RENTABILIDADE_COMPLETA,
    ...parcial
  });
}

export const RESUMOS_DONO: ViagemResumoResponse[] = [
  { id: 206, caminhaoId: 1, placa: 'BCB8H89', motoristaId: 31, motoristaNome: 'Carlos Lima', status: 'EM_ANDAMENTO',
    origem: 'Palmital', destino: null, dataInicio: '2025-03-08', dataFim: null, valorFrete: null, kmVazio: null, kmCarregado: null,
    custoOperacionalTotal: null, lucro: null, margemPercentual: null, calculoCompleto: false },
  { id: 205, caminhaoId: 1, placa: 'BCB8H89', motoristaId: 31, motoristaNome: 'Carlos Lima', status: 'FINALIZADA',
    origem: 'São Paulo', destino: 'Palmital', dataInicio: '2025-03-05', dataFim: '2025-03-07', valorFrete: 3500, kmVazio: 80,
    kmCarregado: 500, custoOperacionalTotal: 1505.5, lucro: 1994.5, margemPercentual: 56.99, calculoCompleto: true }
];

/** Visão do MOTORISTA: campos financeiros nulos (o frete continua visível). */
export const RESUMOS_MOTORISTA: ViagemResumoResponse[] = RESUMOS_DONO.map(v => ({
  ...v, custoOperacionalTotal: null, lucro: null, margemPercentual: null, calculoCompleto: null
}));
