import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AbastecimentoRequest, AbastecimentoResponse, DespesaExtraRequest, DespesaExtraResponse, PedagioRequest, PedagioResponse,
  TipoCombustivel
} from '../../../core/modelos/api.modelos';
import {
  FORMATO, decimalPositivoValidator, paraDecimalApi, paraQuilometragemApi, quilometragemValidator
} from '../../../compartilhado/validadores';

export type GrupoAbastecimento = FormGroup<{
  tipo: FormControl<TipoCombustivel>;
  data: FormControl<string>;
  quilometragem: FormControl<number | null>;
  litros: FormControl<string>;
  valorTotal: FormControl<string>;
}>;

export type GrupoPedagio = FormGroup<{
  data: FormControl<string>;
  valor: FormControl<string>;
}>;

export type GrupoDespesa = FormGroup<{
  descricao: FormControl<string>;
  data: FormControl<string>;
  valor: FormControl<string>;
}>;

export const LIMITE_DESCRICAO_DESPESA = 200;

/**
 * Quilometragem obrigatória em abastecimento novo e depois de informada (não pode ser apagada).
 * Só a correção de registro antigo sem km (`quilometragem: null`) pode continuar sem ela.
 */
export function quilometragemObrigatoria(atual?: AbastecimentoResponse): boolean {
  return !atual || atual.quilometragem !== null;
}

/** Campos do AbastecimentoRequest. Plausibilidade do preço e tanque são do servidor (400). */
export function grupoAbastecimento(fb: FormBuilder, dataPadrao: string, atual?: AbastecimentoResponse, tipo: TipoCombustivel = 'DIESEL'): GrupoAbastecimento {
  const km = quilometragemObrigatoria(atual) ? [Validators.required, quilometragemValidator] : [quilometragemValidator];
  return fb.nonNullable.group({
    tipo: [atual?.tipo ?? tipo, Validators.required],
    data: [atual?.data ?? dataPadrao, Validators.required],
    quilometragem: [atual?.quilometragem ?? null as number | null, km],
    litros: [atual ? String(atual.litros) : '', [Validators.required, decimalPositivoValidator(FORMATO.litros.casas, FORMATO.litros.inteiros)]],
    valorTotal: [atual ? String(atual.valorTotal) : '', [Validators.required, decimalPositivoValidator(FORMATO.dinheiro.casas, FORMATO.dinheiro.inteiros)]]
  });
}

export function grupoPedagio(fb: FormBuilder, dataPadrao: string, atual?: PedagioResponse): GrupoPedagio {
  return fb.nonNullable.group({
    data: [atual?.data ?? dataPadrao, Validators.required],
    valor: [atual ? String(atual.valor) : '', [Validators.required, decimalPositivoValidator(FORMATO.dinheiro.casas, FORMATO.dinheiro.inteiros)]]
  });
}

/** Descrição **livre**: sem categorias, sem bloqueio de palavras (regra do produto). */
export function grupoDespesa(fb: FormBuilder, dataPadrao: string, atual?: DespesaExtraResponse): GrupoDespesa {
  return fb.nonNullable.group({
    descricao: [atual?.descricao ?? '', [Validators.required, Validators.maxLength(LIMITE_DESCRICAO_DESPESA), Validators.pattern(/\S/)]],
    data: [atual?.data ?? dataPadrao, Validators.required],
    valor: [atual ? String(atual.valor) : '', [Validators.required, decimalPositivoValidator(FORMATO.dinheiro.casas, FORMATO.dinheiro.inteiros)]]
  });
}

export function paraAbastecimentoRequest(grupo: GrupoAbastecimento): AbastecimentoRequest {
  const v = grupo.getRawValue();
  return {
    tipo: v.tipo,
    data: v.data,
    // O grupo já foi validado: aqui `null` só sobra no registro antigo sem km.
    quilometragem: paraQuilometragemApi(v.quilometragem),
    litros: paraDecimalApi(v.litros, FORMATO.litros.casas) ?? '',
    valorTotal: paraDecimalApi(v.valorTotal, FORMATO.dinheiro.casas) ?? ''
  };
}

export function paraPedagioRequest(grupo: GrupoPedagio): PedagioRequest {
  const v = grupo.getRawValue();
  return { data: v.data, valor: paraDecimalApi(v.valor, FORMATO.dinheiro.casas) ?? '' };
}

export function paraDespesaRequest(grupo: GrupoDespesa): DespesaExtraRequest {
  const v = grupo.getRawValue();
  return { descricao: v.descricao.trim(), data: v.data, valor: paraDecimalApi(v.valor, FORMATO.dinheiro.casas) ?? '' };
}

/**
 * Preço por litro **só como ajuda de digitação** (valor ÷ litros), antes de enviar.
 * Não é dado oficial; a plausibilidade é conferida pelo servidor.
 */
export function precoPorLitroDigitado(grupo: GrupoAbastecimento): number | null {
  const litros = Number(paraDecimalApi(grupo.controls.litros.value, FORMATO.litros.casas));
  const valor = Number(paraDecimalApi(grupo.controls.valorTotal.value, FORMATO.dinheiro.casas));
  return litros > 0 && valor > 0 ? valor / litros : null;
}
