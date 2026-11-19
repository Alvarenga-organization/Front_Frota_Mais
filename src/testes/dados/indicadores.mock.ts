/** DADOS DE TESTE: exemplo do contrato (junho/2025: um concluído, uma cancelada, uma manutenção). */
import { IndicadoresResponse } from '../../app/core/modelos/api.modelos';

export function indicadores(parcial: Partial<IndicadoresResponse> = {}): IndicadoresResponse {
  return {
    de: '2025-06-01', ate: '2025-06-30', caminhaoId: null, criterioPeriodo: 'DATA_FIM',
    viagensFinalizadas: 1, viagensConsideradas: 1, viagensIncompletas: 0, viagensComCalculoIncompleto: [],
    valorFreteIncompletasNaoIncluido: 0, receitaTotal: 3000, custoDieselVazio: 0, custoDieselCarregado: 1200, custoArla: 0,
    pedagios: 0, despesasExtras: 0, custoOperacionalTotal: 1200, lucroTotal: 1800, margemPercentual: 60, kmVazio: 0,
    kmCarregado: 500, custoPorKm: 2.4, lucroPorKm: 3.6, percentualKmVazio: 0, consumoMedioKmPorLitro: 2.5, dieselPago: 600,
    dieselEstimado: 1200, diferencaDieselPagoEstimado: -600, quantidadeManutencoes: 1, custoManutencoes: 150,
    resultadoAposManutencoes: 1650, viagensCanceladas: 1, canceladasComCustoIncompleto: [], receitaCanceladas: 500,
    custoCanceladas: 300, resultadoCanceladas: 200, resultadoFinanceiroPeriodo: 1850,
    ...parcial
  };
}

/** Período sem dados: contagens zero, somas 0.00 e divisões nulas (comportamento testado no back-end). */
export function indicadoresVazios(): IndicadoresResponse {
  return indicadores({
    viagensFinalizadas: 0, viagensConsideradas: 0, receitaTotal: 0, custoDieselCarregado: 0, custoOperacionalTotal: 0, lucroTotal: 0,
    margemPercentual: null, kmCarregado: 0, custoPorKm: null, lucroPorKm: null, percentualKmVazio: null, consumoMedioKmPorLitro: null,
    dieselPago: 0, dieselEstimado: 0, diferencaDieselPagoEstimado: 0, quantidadeManutencoes: 0, custoManutencoes: 0,
    resultadoAposManutencoes: 0, viagensCanceladas: 0, receitaCanceladas: 0, custoCanceladas: 0, resultadoCanceladas: 0,
    resultadoFinanceiroPeriodo: 0
  });
}
