import { formatarData, formatarMoeda, formatarNumero, hojeEmBrasilia } from './formatacao';
import { decimalPositivoValidator, paraDecimalApi } from './validadores';
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
});
