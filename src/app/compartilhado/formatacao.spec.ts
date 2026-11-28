import { formatarData, formatarMoeda, formatarNumero, hojeEmBrasilia } from './formatacao';
import { decimalPositivoValidator, paraDecimalApi, paraQuilometragemApi, quilometragemValidator } from './validadores';
import { FormControl } from '@angular/forms';

describe('Formatação e conversões', () => {
  it('"hoje" é calculado em America/Sao_Paulo, não em UTC', () => {
    // 01:30 UTC do dia 20 ainda é dia 19 em Brasília (UTC-3).
    expect(hojeEmBrasilia(new Date('2026-11-20T01:30:00Z'))).toBe('2026-11-19');
    expect(hojeEmBrasilia(new Date('2026-11-20T03:30:00Z'))).toBe('2026-11-20');
  });

  it('nulo não é zero: moeda e número nulos viram "—" ou o texto pedido', () => {
    expect(formatarMoeda(null)).toBe('—');
    expect(formatarMoeda(null, 'não calculado')).toBe('não calculado');
    expect(formatarMoeda(0)).toContain('0,00');
    expect(formatarMoeda(1994.5).replace(/\s/g, ' ')).toBe('R$ 1.994,50');
    expect(formatarNumero(null)).toBe('—');
  });

  it('data AAAA-MM-DD → dd/mm/aaaa sem deslocamento de fuso', () => {
    expect(formatarData('2025-03-01')).toBe('01/03/2025');
    expect(formatarData(null)).toBe('—');
  });

  it('paraDecimalApi converte a digitação brasileira para o texto da API', () => {
    expect(paraDecimalApi('1.553,10', 2)).toBe('1553.10');
    expect(paraDecimalApi('250,5', 3)).toBe('250.5');
    expect(paraDecimalApi('1500.00', 2)).toBe('1500.00');
    expect(paraDecimalApi(' 3500 ', 2)).toBe('3500');
    expect(paraDecimalApi('1,234', 2)).toBeNull();
    expect(paraDecimalApi('abc', 2)).toBeNull();
    expect(paraDecimalApi('', 2)).toBeNull();
  });

  it('decimalPositivoValidator: positivo, casas e máximo (consumo até 99,99)', () => {
    const consumo = new FormControl('', decimalPositivoValidator(2, 2, 99.99));
    consumo.setValue('2,50'); expect(consumo.valid).toBeTrue();
    consumo.setValue('0'); expect(consumo.hasError('positivo')).toBeTrue();
    consumo.setValue('100'); expect(consumo.valid).toBeFalse();
    consumo.setValue('2,555'); expect(consumo.hasError('decimal')).toBeTrue();
    consumo.setValue(''); expect(consumo.valid).toBeTrue();
  });

  it('paraQuilometragemApi: só inteiro de 0 a 9.999.999, sem arredondar nem converter texto inválido', () => {
    expect(paraQuilometragemApi(0)).toBe(0);
    expect(paraQuilometragemApi(9_999_999)).toBe(9_999_999);
    expect(paraQuilometragemApi('10450')).toBe(10450);
    for (const invalido of [10_000_000, -1, 1500.5, NaN, '1500.5', '1,5', '1e3', '12a', '-5', '', null, undefined]) {
      expect(paraQuilometragemApi(invalido)).withContext(String(invalido)).toBeNull();
    }
  });

  it('quilometragemValidator: vazio fica com o required; inválido acusa erro', () => {
    const km = new FormControl<number | string | null>(null, quilometragemValidator);
    expect(km.valid).toBeTrue();
    km.setValue(1500.5); expect(km.hasError('quilometragem')).toBeTrue();
    km.setValue(10_000_000); expect(km.hasError('quilometragem')).toBeTrue();
    km.setValue(10450); expect(km.valid).toBeTrue();
  });
});
