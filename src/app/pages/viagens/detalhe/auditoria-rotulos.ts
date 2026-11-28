import { EntidadeAuditada } from '../../../core/modelos/api.modelos';

export const ROTULO_ENTIDADE_AUDITORIA: Record<EntidadeAuditada, string> = {
  VIAGEM: 'Viagem',
  ABASTECIMENTO: 'Abastecimento',
  PEDAGIO: 'Pedágio',
  DESPESA_EXTRA: 'Despesa extra'
};

/** Nomes técnicos de `campo` na auditoria → rótulos. Campo desconhecido é exibido como veio. */
export const ROTULO_CAMPO_AUDITORIA: Partial<Record<string, string>> = {
  dataInicio: 'Data de partida',
  dataFim: 'Data final',
  valorFrete: 'Valor do frete',
  origem: 'Origem',
  destino: 'Destino',
  kmInicialVazio: 'Km na saída vazia',
  kmInicialCarregado: 'Km no carregamento',
  kmFinalCarregado: 'Km na descarga',
  consumoMedioVazio: 'Consumo médio vazio',
  consumoMedioCarregado: 'Consumo médio carregado',
  motoristaId: 'Motorista responsável (id)',
  tipo: 'Combustível',
  data: 'Data',
  quilometragem: 'Quilometragem do caminhão (km)',
  /** Legado (contrato 1.1): aparece só em alterações antigas. */
  hora: 'Hora',
  litros: 'Litros',
  valorTotal: 'Valor pago',
  valor: 'Valor',
  descricao: 'Descrição'
};
