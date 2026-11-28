import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Política de senha nova (registro, ativação e troca): 8 caracteres a 72 bytes
 * em UTF-8, com ao menos uma letra e um número. Validação só de ajuda ao
 * usuário; o servidor confere de novo.
 */
export const senhaNovaValidator: ValidatorFn = (controle: AbstractControl): ValidationErrors | null => {
  const valor = String(controle.value ?? '');
  if (!valor) return null;
  const erros: ValidationErrors = {};
  if ([...valor].length < 8) erros['senhaCurta'] = true;
  if (new TextEncoder().encode(valor).length > 72) erros['senhaLonga'] = true;
  if (!/\p{L}/u.test(valor) || !/\d/.test(valor)) erros['senhaLetraNumero'] = true;
  return Object.keys(erros).length ? erros : null;
};

/** Grupo com `senha` e `confirmacao` iguais. */
export const confirmacaoSenhaValidator: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const senha = grupo.get('senha')?.value;
  const confirmacao = grupo.get('confirmacao')?.value;
  return senha && confirmacao && senha !== confirmacao ? { confirmacaoDiferente: true } : null;
};

/** Número inteiro (km, ano, eixos, litros do tanque). Vazio é tratado pelo `required`. */
export const inteiroValidator: ValidatorFn = (controle: AbstractControl): ValidationErrors | null => {
  const valor = controle.value;
  if (valor === null || valor === undefined || valor === '') return null;
  return Number.isInteger(Number(valor)) ? null : { inteiro: true };
};

/**
 * Quilometragem (odômetro) no formato do contrato: inteiro de 0 a 9.999.999.
 * Aceita número inteiro ou texto só com dígitos; qualquer outra coisa ("1,5", "1e3",
 * decimal, negativo) devolve `null`. Nunca arredonda nem corrige o valor.
 */
export function paraQuilometragemApi(valor: unknown): number | null {
  let numero: number;
  if (typeof valor === 'number') {
    numero = valor;
  } else if (typeof valor === 'string' && /^\d+$/.test(valor.trim())) {
    numero = Number(valor.trim());
  } else {
    return null;
  }
  return Number.isInteger(numero) && numero >= FORMATO.km.minimo && numero <= FORMATO.km.maximo ? numero : null;
}

/** Quilometragem válida (ver `paraQuilometragemApi`). Vazio é tratado pelo `required`. */
export const quilometragemValidator: ValidatorFn = (controle: AbstractControl): ValidationErrors | null => {
  const valor = controle.value;
  if (valor === null || valor === undefined || valor === '') return null;
  return paraQuilometragemApi(valor) === null ? { quilometragem: true } : null;
};

/**
 * Converte o número digitado ("1.500,50", "1500.5", "250,5") para o texto aceito pela
 * API ("1500.50" / "250.5"). Devolve `null` se vazio ou inválido. Não arredonda:
 * mais casas que o permitido torna o valor inválido.
 */
export function paraDecimalApi(valor: unknown, casas: number): string | null {
  if (valor === null || valor === undefined) return null;
  let texto = String(valor).trim().replace(/\s/g, '');
  if (!texto) return null;
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
  const padrao = new RegExp(`^\\d+(\\.\\d{1,${casas}})?$`);
  return padrao.test(texto) ? texto : null;
}

/**
 * Decimal positivo digitado pelo usuário: até `casas` casas e `inteiros` dígitos
 * antes da vírgula; maior que zero. Vazio é tratado pelo `required`.
 */
export function decimalPositivoValidator(casas: number, inteiros: number, maximo?: number): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const bruto = controle.value;
    if (bruto === null || bruto === undefined || String(bruto).trim() === '') return null;
    const texto = paraDecimalApi(bruto, casas);
    if (texto === null) return { decimal: { casas } };
    const [parteInteira] = texto.split('.');
    const numero = Number(texto);
    if (parteInteira.replace(/^0+(?=\d)/, '').length > inteiros) return { decimal: { casas } };
    if (numero <= 0) return { positivo: true };
    if (maximo !== undefined && numero > maximo) return { maximo: { maximo } };
    return null;
  };
}

/** Limites de formato do contrato (seção de convenções da API). */
export const FORMATO = {
  dinheiro: { casas: 2, inteiros: 15 },
  litros: { casas: 3, inteiros: 7 },
  consumo: { casas: 2, inteiros: 2, maximo: 99.99 },
  km: { minimo: 0, maximo: 9_999_999 }
} as const;
